import { NextRequest, NextResponse } from 'next/server';

import { setBlogAuthStateCookie } from '@/lib/auth/app-auth-cookies';
import {
  BLOG_AUTH_COOKIE_MAX_AGE_SECONDS,
  buildAuthorizeUrl,
  createBlogAuthStatePayload,
  encodeBlogAuthStatePayload,
  normalizeReturnTo,
} from '@/lib/auth/blog-auth';

export async function GET(request: NextRequest) {
  const returnTo = normalizeReturnTo(request.nextUrl.searchParams.get('returnTo') ?? undefined);
  const authState = createBlogAuthStatePayload(returnTo);
  const response = NextResponse.redirect(new URL(buildAuthorizeUrl(authState)), 307);

  setBlogAuthStateCookie(
    response,
    encodeBlogAuthStatePayload(authState),
    BLOG_AUTH_COOKIE_MAX_AGE_SECONDS
  );

  return response;
}
