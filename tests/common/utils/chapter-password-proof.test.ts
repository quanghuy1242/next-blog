import { describe, expect, test } from 'vitest';
import {
  CHAPTER_PASSWORD_PROOF_COOKIE,
  getChapterPasswordProofCookieValueFromRequest,
  normalizeChapterPasswordProofCookieValue,
  updateChapterPasswordProofCookieValue,
} from 'common/utils/chapter-password-proof';

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

describe('chapter password proof helpers', () => {
  test('normalizes and deduplicates chapter password proofs', () => {
    const now = 1_700_000_000_000;
    const expiredProof = createChapterPasswordProof({
      chapterId: '7',
      expiresAt: now - 1,
      passwordVersion: 1,
    });
    const olderProof = createChapterPasswordProof({
      chapterId: '7',
      expiresAt: now + 30_000,
      passwordVersion: 1,
    });
    const newerProof = createChapterPasswordProof({
      chapterId: '7',
      expiresAt: now + 60_000,
      passwordVersion: 1,
    });
    const anotherProof = createChapterPasswordProof({
      chapterId: '8',
      expiresAt: now + 45_000,
      passwordVersion: 2,
    });

    expect(
      normalizeChapterPasswordProofCookieValue(
        [
          ` ${expiredProof} `,
          olderProof,
          anotherProof,
          newerProof,
        ].join(', '),
        now
      )
    ).toBe([newerProof, anotherProof].join(', '));
  });

  test('builds a cookie payload and expires it with the newest proof', () => {
    const currentValue = [
      createChapterPasswordProof({
        chapterId: '7',
        expiresAt: 1_700_000_060_000,
        passwordVersion: 1,
      }),
      createChapterPasswordProof({
        chapterId: '8',
        expiresAt: 1_700_000_040_000,
        passwordVersion: 2,
      }),
    ].join(', ');
    const nextProof = createChapterPasswordProof({
      chapterId: '7',
      expiresAt: 1_700_000_090_000,
      passwordVersion: 3,
    });

    const result = updateChapterPasswordProofCookieValue(currentValue, nextProof, 1_700_000_000_000);

    expect(result.value).toBe([nextProof, currentValue.split(', ')[1]].join(', '));
    expect(result.expiresAt?.toISOString()).toBe(new Date(1_700_000_090_000).toISOString());
  });

  test('reads proof cookies from the request', () => {
    const proof = createChapterPasswordProof({
      chapterId: '9',
      expiresAt: 4_102_444_800_000,
      passwordVersion: 1,
    });

    expect(
      getChapterPasswordProofCookieValueFromRequest({
        cookies: {
          [CHAPTER_PASSWORD_PROOF_COOKIE]: proof,
        },
      })
    ).toBe(proof);
  });
});
