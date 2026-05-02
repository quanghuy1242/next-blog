import crypto from 'crypto';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  buildPreviewTokenForTests,
  validatePreviewToken,
  type PreviewPayload,
} from 'common/utils/preview';

function createPreviewPayload(overrides: Partial<PreviewPayload> = {}): PreviewPayload {
  return {
    docType: overrides.docType ?? 'post',
    docId: overrides.docId ?? '42',
    slug: overrides.slug ?? 'draft-post',
    expiresAt: overrides.expiresAt ?? Date.now() + 60_000,
  };
}

describe('preview token validation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('accepts tokens signed from the raw payload json', () => {
    vi.stubEnv('PAYLOAD_PREVIEW_SECRET', 'preview-secret');
    const payload = createPreviewPayload();

    const result = validatePreviewToken(
      buildPreviewTokenForTests(payload, 'preview-secret'),
      payload.expiresAt - 1
    );

    expect(result).toEqual({
      ok: true,
      payload,
    });
  });

  test('rejects tokens signed from the base64 payload segment', () => {
    vi.stubEnv('PAYLOAD_PREVIEW_SECRET', 'preview-secret');
    const payload = createPreviewPayload();
    const payloadJson = JSON.stringify(payload);
    const payloadPart = Buffer.from(payloadJson, 'utf8').toString('base64url');
    const invalidSignature = crypto
      .createHmac('sha256', 'preview-secret')
      .update(payloadPart)
      .digest('base64url');

    const result = validatePreviewToken(
      `${payloadPart}.${invalidSignature}`,
      payload.expiresAt - 1
    );

    expect(result).toEqual({
      ok: false,
      reason: 'invalid-signature',
    });
  });

  test('rejects expired tokens', () => {
    vi.stubEnv('PAYLOAD_PREVIEW_SECRET', 'preview-secret');
    const payload = createPreviewPayload({ expiresAt: Date.now() - 1_000 });

    const result = validatePreviewToken(
      buildPreviewTokenForTests(payload, 'preview-secret')
    );

    expect(result).toEqual({
      ok: false,
      reason: 'expired',
    });
  });
});
