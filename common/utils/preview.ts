import crypto from 'crypto';

export interface PreviewPayload {
  docType: string;
  docId: string;
  slug: string;
  expiresAt: number;
}

export type PreviewTokenValidationResult =
  | { ok: true; payload: PreviewPayload }
  | {
      ok: false;
      reason:
        | 'missing-secret'
        | 'malformed'
        | 'invalid-signature'
        | 'invalid-payload'
        | 'expired';
    };

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string): string | null {
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

function getPreviewSecret(): string | null {
  const secret = process.env.PAYLOAD_PREVIEW_SECRET?.trim();

  return secret ? secret : null;
}

function normalizePreviewPayload(payload: unknown): PreviewPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const rawPayload = payload as Record<string, unknown>;
  const docType =
    typeof rawPayload.docType === 'string' ? rawPayload.docType.trim() : '';
  const rawDocId = rawPayload.docId;
  const docId =
    typeof rawDocId === 'number'
      ? String(rawDocId)
      : typeof rawDocId === 'string'
        ? rawDocId.trim()
        : '';
  const slug = typeof rawPayload.slug === 'string' ? rawPayload.slug.trim() : '';
  const expiresAt =
    typeof rawPayload.expiresAt === 'number'
      ? rawPayload.expiresAt
      : typeof rawPayload.expiresAt === 'string'
        ? Number(rawPayload.expiresAt.trim())
        : Number.NaN;

  if (!docType || !docId || !slug || !Number.isFinite(expiresAt)) {
    return null;
  }

  return {
    docType,
    docId,
    slug,
    expiresAt: Math.floor(expiresAt),
  };
}

export function validatePreviewToken(
  token: string,
  now = Date.now()
): PreviewTokenValidationResult {
  const secret = getPreviewSecret();

  if (!secret) {
    return {
      ok: false,
      reason: 'missing-secret',
    };
  }

  const parts = token.trim().split('.');

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return {
      ok: false,
      reason: 'malformed',
    };
  }

  const [payloadPart, signaturePart] = parts;
  const payloadJson = decodeBase64Url(payloadPart);

  if (!payloadJson) {
    return {
      ok: false,
      reason: 'malformed',
    };
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadJson)
    .digest('base64url');

  const providedSignatureBuffer = Buffer.from(signaturePart, 'utf8');
  const expectedSignatureBuffer = Buffer.from(expectedSignature, 'utf8');

  if (
    providedSignatureBuffer.length !== expectedSignatureBuffer.length ||
    !crypto.timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer)
  ) {
    return {
      ok: false,
      reason: 'invalid-signature',
    };
  }

  let parsedPayload: unknown;

  try {
    parsedPayload = JSON.parse(payloadJson);
  } catch {
    return {
      ok: false,
      reason: 'invalid-payload',
    };
  }

  const normalizedPayload = normalizePreviewPayload(parsedPayload);

  if (!normalizedPayload) {
    return {
      ok: false,
      reason: 'invalid-payload',
    };
  }

  if (normalizedPayload.expiresAt <= now) {
    return {
      ok: false,
      reason: 'expired',
    };
  }

  return {
    ok: true,
    payload: normalizedPayload,
  };
}

export function buildPreviewTokenForTests(payload: PreviewPayload, secret: string): string {
  const payloadJson = JSON.stringify(payload);
  const payloadPart = encodeBase64Url(payloadJson);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadJson)
    .digest('base64url');

  return `${payloadPart}.${signature}`;
}
