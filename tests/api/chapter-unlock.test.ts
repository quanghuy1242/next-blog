import type { NextApiRequest, NextApiResponse } from 'next';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { CHAPTER_PASSWORD_PROOF_COOKIE } from 'common/utils/chapter-password-proof';

function createChapterPasswordProof({
  chapterId,
  expiresAt,
  passwordVersion,
}: {
  chapterId: string;
  expiresAt: number;
  passwordVersion: number;
}): string {
  const payload = Buffer.from(
    JSON.stringify({
      chapterId,
      expiresAt,
      passwordVersion,
    })
  )
    .toString('base64url');

  return `v1.${payload}.signature-${chapterId}`;
}

function createResponseMock() {
  const headers = new Map<string, string>();

  const response = {
    jsonBody: null as unknown,
    statusCode: 200,
    getHeader(name: string) {
      return headers.get(name.toLowerCase()) ?? null;
    },
    json(body: unknown) {
      this.jsonBody = body;
      return this;
    },
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
  };

  return response as typeof response & NextApiResponse;
}

describe('chapter unlock API route', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  test('stores the proof cookie and returns the unlock payload', async () => {
    const oldProof = createChapterPasswordProof({
      chapterId: '7',
      expiresAt: Date.now() + 30_000,
      passwordVersion: 2,
    });
    const newProof = createChapterPasswordProof({
      chapterId: '7',
      expiresAt: Date.now() + 60_000,
      passwordVersion: 3,
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            unlockChapterPassword: {
              chapterId: '7',
              expiresAt: '2026-04-27T14:16:30.043Z',
              proof: newProof,
            },
          },
        }),
        {
          headers: {
            'Content-Type': 'application/json',
          },
          status: 200,
        }
      )
    );

    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('PAYLOAD_BASE_URL', 'https://payload.example.com');
    vi.stubEnv('PAYLOAD_API_KEY', 'payload-api-key');
    const { default: handler } = await import('pages/api/chapters/unlock');

    const req = {
      body: {
        chapterId: '7',
        password: 'open-sesame',
      },
      cookies: {
        [CHAPTER_PASSWORD_PROOF_COOKIE]: oldProof,
      },
      method: 'POST',
    } as unknown as NextApiRequest;
    const res = createResponseMock();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({
      chapterId: '7',
      expiresAt: '2026-04-27T14:16:30.043Z',
      proof: newProof,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://payload.example.com/api/graphql',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'users API-Key payload-api-key',
          'Content-Type': 'application/json',
        }),
      })
    );

    const setCookieHeader = res.getHeader('Set-Cookie');
    expect(setCookieHeader).toContain('HttpOnly');
    expect(setCookieHeader).toContain('SameSite=Lax');
    expect(decodeURIComponent(String(setCookieHeader))).toContain(newProof);
    expect(decodeURIComponent(String(setCookieHeader))).not.toContain(oldProof);
  });
});
