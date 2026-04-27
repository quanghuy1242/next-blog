import type { NextApiRequest, NextApiResponse } from 'next';
import {
  CHAPTER_PASSWORD_PROOF_COOKIE,
  getChapterPasswordProofCookieValueFromRequest,
  updateChapterPasswordProofCookieValue,
} from 'common/utils/chapter-password-proof';

const PAYLOAD_BASE_URL = process.env.PAYLOAD_BASE_URL;
const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;

const API_URL = PAYLOAD_BASE_URL ? `${PAYLOAD_BASE_URL}/api/graphql` : '';

const UNLOCK_CHAPTER_PASSWORD_MUTATION = `mutation UnlockChapterPassword($chapterId: ID!, $password: String!) {
  unlockChapterPassword(chapterId: $chapterId, password: $password) {
    chapterId
    expiresAt
    proof
  }
}`;

type UnlockChapterPasswordResponse = {
  chapterId: string;
  expiresAt: string;
  proof: string;
};

type GraphQLResponse = {
  data?: {
    unlockChapterPassword?: UnlockChapterPasswordResponse | null;
  };
  errors?: Array<{ message?: string }>;
};

function serializeChapterPasswordCookie(value: string, expiresAt: Date): string {
  const parts = [
    `${CHAPTER_PASSWORD_PROOF_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${expiresAt.toUTCString()}`,
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function parseRequestBody(
  body: NextApiRequest['body']
): { chapterId?: unknown; password?: unknown } | null {
  if (!body) {
    return null;
  }

  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as { chapterId?: unknown; password?: unknown };
    } catch {
      return null;
    }
  }

  if (typeof body === 'object') {
    return body as { chapterId?: unknown; password?: unknown };
  }

  return null;
}

function mapUnlockErrorMessage(message: string | null | undefined): string {
  if (!message) {
    return 'Unable to unlock this chapter.';
  }

  if (message.includes('Password invalid')) {
    return 'Incorrect password.';
  }

  if (message.includes('not password-protected')) {
    return 'This chapter is not locked.';
  }

  return message;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (!PAYLOAD_BASE_URL || !API_URL) {
    res.status(500).json({ error: 'Chapter unlock is unavailable.' });
    return;
  }

  const body = parseRequestBody(req.body);
  const chapterIdValue = body?.chapterId;
  const chapterId =
    typeof chapterIdValue === 'string' || typeof chapterIdValue === 'number'
      ? String(chapterIdValue).trim()
      : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!chapterId) {
    res.status(400).json({ error: 'Chapter ID is required.' });
    return;
  }

  if (password.length === 0) {
    res.status(400).json({ error: 'Password is required.' });
    return;
  }

  try {
    const payloadResponse = await fetch(API_URL, {
      body: JSON.stringify({
        query: UNLOCK_CHAPTER_PASSWORD_MUTATION,
        variables: {
          chapterId,
          password,
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        ...(PAYLOAD_API_KEY ? { Authorization: `users API-Key ${PAYLOAD_API_KEY}` } : {}),
      },
      method: 'POST',
    });

    const payloadJson = (await payloadResponse.json()) as GraphQLResponse;
    const graphQLErrorMessage = payloadJson.errors?.[0]?.message ?? null;

    if (!payloadResponse.ok || graphQLErrorMessage) {
      res.status(payloadResponse.ok ? 400 : payloadResponse.status).json({
        error: mapUnlockErrorMessage(graphQLErrorMessage),
      });
      return;
    }

    const unlockResult = payloadJson.data?.unlockChapterPassword;

    if (!unlockResult) {
      res.status(500).json({ error: 'Unable to unlock this chapter.' });
      return;
    }

    const currentCookie = getChapterPasswordProofCookieValueFromRequest(req);
    const updatedCookie = updateChapterPasswordProofCookieValue(currentCookie, unlockResult.proof);

    if (updatedCookie.value && updatedCookie.expiresAt) {
      res.setHeader('Set-Cookie', serializeChapterPasswordCookie(updatedCookie.value, updatedCookie.expiresAt));
    }

    res.status(200).json(unlockResult);
  } catch {
    res.status(500).json({ error: 'Unable to unlock this chapter.' });
  }
}
