import { NextRequest, NextResponse } from 'next/server';

import {
  clearBlogAuthStateCookie,
  setBlogAuthTokenCookies,
} from '@/lib/auth/app-auth-cookies';
import {
  BLOG_AUTH_STATE_COOKIE,
  decodeBlogAuthStatePayload,
  exchangeAuthorizationCode,
  getTokenCookieMaxAgeSeconds,
  isBlogAuthStateExpired,
} from '@/lib/auth/blog-auth';

export async function GET(request: NextRequest) {
  const fallbackDestination = '/';
  const pkceCookie = decodeBlogAuthStatePayload(
    request.cookies.get(BLOG_AUTH_STATE_COOKIE)?.value
  );

  if (!pkceCookie || isBlogAuthStateExpired(pkceCookie)) {
    const response = NextResponse.redirect(new URL(fallbackDestination, request.url), 307);
    clearBlogAuthStateCookie(response);
    return response;
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const destination = pkceCookie.returnTo || fallbackDestination;

  if (!code || !state || state !== pkceCookie.state) {
    const response = NextResponse.redirect(new URL(destination, request.url), 307);
    clearBlogAuthStateCookie(response);
    return response;
  }

  try {
    const tokenResponse = await exchangeAuthorizationCode({
      code,
      verifier: pkceCookie.verifier,
    });
    const maxAgeSeconds = getTokenCookieMaxAgeSeconds(tokenResponse.expiresIn);
    const response = NextResponse.redirect(new URL(destination, request.url), 307);

    setBlogAuthTokenCookies({
      maxAgeSeconds,
      requestHeaders: {
        host: request.headers.get('host') ?? undefined,
        'x-forwarded-host': request.headers.get('x-forwarded-host') ?? undefined,
      },
      response,
      token: tokenResponse.accessToken,
    });
    clearBlogAuthStateCookie(response);

    return response;
  } catch {
    const response = NextResponse.redirect(new URL(destination, request.url), 307);
    clearBlogAuthStateCookie(response);
    return response;
  }
}
