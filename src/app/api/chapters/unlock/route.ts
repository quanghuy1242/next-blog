import { NextRequest, NextResponse } from 'next/server';

import {
  CHAPTER_PASSWORD_PROOF_COOKIE,
  getChapterPasswordProofCookieValueFromRequest,
  updateChapterPasswordProofCookieValue,
} from '@/lib/server/chapter-password-proof';
import { methodNotAllowed, noStoreJson, parseJsonBody } from '@/lib/server/http';

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

function mapUnlockErrorMessage(message: string | null | undefined) {
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

export async function POST(request: NextRequest) {
  if (!PAYLOAD_BASE_URL || !API_URL) {
    return noStoreJson({ error: 'Chapter unlock is unavailable.' }, { status: 500 });
  }

  const body = await parseJsonBody<{ chapterId?: unknown; password?: unknown }>(request);
  const chapterId =
    typeof body?.chapterId === 'string' || typeof body?.chapterId === 'number'
      ? String(body.chapterId).trim()
      : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!chapterId) {
    return noStoreJson({ error: 'Chapter ID is required.' }, { status: 400 });
  }

  if (password.length === 0) {
    return noStoreJson({ error: 'Password is required.' }, { status: 400 });
  }

  try {
    const payloadResponse = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(PAYLOAD_API_KEY ? { Authorization: `users API-Key ${PAYLOAD_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        query: UNLOCK_CHAPTER_PASSWORD_MUTATION,
        variables: { chapterId, password },
      }),
    });

    const payloadJson = (await payloadResponse.json()) as GraphQLResponse;
    const graphQLErrorMessage = payloadJson.errors?.[0]?.message ?? null;

    if (!payloadResponse.ok || graphQLErrorMessage) {
      return noStoreJson(
        { error: mapUnlockErrorMessage(graphQLErrorMessage) },
        { status: payloadResponse.ok ? 400 : payloadResponse.status }
      );
    }

    const unlockResult = payloadJson.data?.unlockChapterPassword;

    if (!unlockResult) {
      return noStoreJson({ error: 'Unable to unlock this chapter.' }, { status: 500 });
    }

    const currentCookie = getChapterPasswordProofCookieValueFromRequest({
      cookies: Object.fromEntries(request.cookies.getAll().map((cookie) => [cookie.name, cookie.value])),
    });
    const updatedCookie = updateChapterPasswordProofCookieValue(currentCookie, unlockResult.proof);
    const response = NextResponse.json(unlockResult, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });

    if (updatedCookie.value && updatedCookie.expiresAt) {
      response.cookies.set(CHAPTER_PASSWORD_PROOF_COOKIE, updatedCookie.value, {
        expires: updatedCookie.expiresAt,
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }

    return response;
  } catch {
    return noStoreJson({ error: 'Unable to unlock this chapter.' }, { status: 500 });
  }
}

export function GET() {
  return methodNotAllowed(['POST']);
}
