import { NextRequest } from 'next/server';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { CHAPTER_PASSWORD_PROOF_COOKIE } from '@/lib/server/chapter-password-proof';

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
    const { POST } = await import('@/app/api/chapters/unlock/route');
    const response = await POST(
      new NextRequest('http://localhost/api/chapters/unlock', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `${CHAPTER_PASSWORD_PROOF_COOKIE}=${encodeURIComponent(oldProof)}`,
        },
        body: JSON.stringify({
          chapterId: '7',
          password: 'open-sesame',
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
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

    const setCookieHeader = response.headers.get('set-cookie');
    expect(setCookieHeader).toContain('HttpOnly');
    expect(setCookieHeader).toContain('SameSite=lax');
    expect(decodeURIComponent(String(setCookieHeader))).toContain(newProof);
    expect(decodeURIComponent(String(setCookieHeader))).not.toContain(oldProof);
  });
});
