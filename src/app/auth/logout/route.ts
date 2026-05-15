import { NextRequest, NextResponse } from 'next/server';

import {
  clearBlogAuthStateCookie,
  clearBlogAuthTokenCookies,
} from '@/lib/domain/auth/next-cookies';
import { getBlogPostLogoutRedirectUri, normalizeReturnTo } from '@/lib/domain/auth/oauth';

export async function GET(request: NextRequest) {
  const requestedReturnTo = normalizeReturnTo(
    request.nextUrl.searchParams.get('returnTo') ?? undefined
  );
  const destination =
    requestedReturnTo !== '/'
      ? requestedReturnTo
      : getBlogPostLogoutRedirectUri({
          headers: {
            host: request.headers.get('host') ?? undefined,
            'x-forwarded-host': request.headers.get('x-forwarded-host') ?? undefined,
            'x-forwarded-proto': request.headers.get('x-forwarded-proto') ?? undefined,
          },
        });

  const response = NextResponse.redirect(new URL(destination, request.url), 307);

  clearBlogAuthStateCookie(response);
  clearBlogAuthTokenCookies(response, {
    host: request.headers.get('host') ?? undefined,
    'x-forwarded-host': request.headers.get('x-forwarded-host') ?? undefined,
  });

  return response;
}
