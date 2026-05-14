import { NextRequest, NextResponse } from 'next/server';

import { getBetterAuthTokenFromRequest } from '@/lib/auth/auth';
import { getChapterPasswordProofCookieValueFromRequest } from '@/lib/server/chapter-password-proof';

export function noStoreHeaders() {
  return {
    'Cache-Control': 'no-store, max-age=0',
  };
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function noStoreJson(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...noStoreHeaders(),
      ...(init?.headers ?? {}),
    },
  });
}

export function methodNotAllowed(methods: string[]) {
  return NextResponse.json(
    { error: 'Method Not Allowed' },
    {
      status: 405,
      headers: {
        Allow: methods.join(', '),
      },
    }
  );
}

export async function parseJsonBody<T extends Record<string, unknown>>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function getSearchParam(url: URL, key: string) {
  const value = url.searchParams.get(key);
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

export function getAllSearchParams(url: URL, key: string) {
  return url.searchParams
    .getAll(key)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function getAuthTokenFromNextRequest(request: NextRequest) {
  return getBetterAuthTokenFromRequest({
    cookies: Object.fromEntries(request.cookies.getAll().map((cookie) => [cookie.name, cookie.value])),
    headers: {
      authorization: request.headers.get('authorization') ?? undefined,
    },
  });
}

export function getChapterProofFromNextRequest(request: NextRequest) {
  return getChapterPasswordProofCookieValueFromRequest({
    cookies: Object.fromEntries(request.cookies.getAll().map((cookie) => [cookie.name, cookie.value])),
  });
}
