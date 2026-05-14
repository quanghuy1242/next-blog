const CHAPTER_PASSWORD_PROOF_VERSION = 'v1' as const;

export const CHAPTER_PASSWORD_PROOF_COOKIE = 'chapter-password-proof' as const;

type ChapterPasswordProofPayload = {
  chapterId: string;
  expiresAt: number;
  passwordVersion: number;
};

type DecodedChapterPasswordProof = {
  chapterId: string;
  expiresAt: number;
  passwordVersion: number;
  proof: string;
};

type RequestWithCookies = {
  cookies?: Record<string, string | string[] | undefined>;
};

function splitChapterPasswordProofValue(value: string | null | undefined): string[] {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return [];
  }

  return value
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function normalizeChapterId(value: unknown): string | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }

    return String(Math.trunc(value));
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizePositiveInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value !== 'string') {
    return null;
  }

  const parsedValue = Number.parseInt(value.trim(), 10);

  return Number.isFinite(parsedValue) ? Math.max(0, Math.floor(parsedValue)) : null;
}

function decodeChapterPasswordProof(proof: string): DecodedChapterPasswordProof | null {
  if (typeof proof !== 'string' || proof.trim().length === 0) {
    return null;
  }

  const [version, payloadPart] = proof.split('.');

  if (version !== CHAPTER_PASSWORD_PROOF_VERSION || !payloadPart) {
    return null;
  }

  let payload: ChapterPasswordProofPayload | null = null;

  try {
    payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as ChapterPasswordProofPayload;
  } catch {
    return null;
  }

  const chapterId = normalizeChapterId(payload?.chapterId);
  const expiresAt = normalizePositiveInteger(payload?.expiresAt);
  const passwordVersion = normalizePositiveInteger(payload?.passwordVersion);

  if (!chapterId || expiresAt == null || passwordVersion == null) {
    return null;
  }

  return {
    chapterId,
    expiresAt,
    passwordVersion,
    proof: proof.trim(),
  };
}

function compareProofEntries(first: DecodedChapterPasswordProof, second: DecodedChapterPasswordProof): number {
  const chapterComparison = first.chapterId.localeCompare(second.chapterId, undefined, {
    numeric: true,
    sensitivity: 'base',
  });

  if (chapterComparison !== 0) {
    return chapterComparison;
  }

  if (first.expiresAt !== second.expiresAt) {
    return first.expiresAt - second.expiresAt;
  }

  if (first.passwordVersion !== second.passwordVersion) {
    return first.passwordVersion - second.passwordVersion;
  }

  return first.proof.localeCompare(second.proof);
}

function normalizeProofEntries(
  value: string | null | undefined,
  now = Date.now()
): DecodedChapterPasswordProof[] {
  const latestByChapterId = new Map<string, DecodedChapterPasswordProof>();

  for (const proof of splitChapterPasswordProofValue(value)) {
    const decodedProof = decodeChapterPasswordProof(proof);

    if (!decodedProof || decodedProof.expiresAt <= now) {
      continue;
    }

    const previousProof = latestByChapterId.get(decodedProof.chapterId);

    if (!previousProof || previousProof.expiresAt <= decodedProof.expiresAt) {
      latestByChapterId.set(decodedProof.chapterId, decodedProof);
    }
  }

  return Array.from(latestByChapterId.values()).sort(compareProofEntries);
}

export function normalizeChapterPasswordProofCookieValue(
  value: string | null | undefined,
  now = Date.now()
): string | null {
  const normalizedProofs = normalizeProofEntries(value, now).map((entry) => entry.proof);

  return normalizedProofs.length > 0 ? normalizedProofs.join(', ') : null;
}

export function getChapterPasswordProofCookieValueFromRequest(
  request?: RequestWithCookies | null
): string | null {
  const rawValue = request?.cookies?.[CHAPTER_PASSWORD_PROOF_COOKIE];

  if (Array.isArray(rawValue)) {
    return normalizeChapterPasswordProofCookieValue(rawValue.join(', '));
  }

  if (typeof rawValue === 'string') {
    return normalizeChapterPasswordProofCookieValue(rawValue);
  }

  return null;
}

export function updateChapterPasswordProofCookieValue(
  currentValue: string | null | undefined,
  nextProof: string,
  now = Date.now()
): { expiresAt: Date | null; value: string | null } {
  const decodedNextProof = decodeChapterPasswordProof(nextProof);

  if (!decodedNextProof || decodedNextProof.expiresAt <= now) {
    throw new Error('Invalid chapter password proof.');
  }

  const normalizedCurrentProofs = normalizeProofEntries(currentValue, now).filter(
    (proof) => proof.chapterId !== decodedNextProof.chapterId
  );
  const normalizedProofs = [...normalizedCurrentProofs, decodedNextProof].sort(compareProofEntries);
  const expiresAt = normalizedProofs.reduce((latestExpiresAt, proof) => {
    return proof.expiresAt > latestExpiresAt ? proof.expiresAt : latestExpiresAt;
  }, 0);

  return {
    expiresAt: expiresAt > 0 ? new Date(expiresAt) : null,
    value: normalizedProofs.length > 0 ? normalizedProofs.map((proof) => proof.proof).join(', ') : null,
  };
}

export function buildChapterPasswordProofCacheKey(
  value: string | null | undefined
): string | null {
  return normalizeChapterPasswordProofCookieValue(value);
}
