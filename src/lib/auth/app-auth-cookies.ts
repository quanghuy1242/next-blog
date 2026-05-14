import { NextResponse } from 'next/server';

import {
  PAYLOAD_ADMIN_TOKEN_COOKIE,
  PAYLOAD_BETTER_AUTH_TOKEN_COOKIE,
} from '@/lib/auth/auth';
import { BLOG_AUTH_STATE_COOKIE } from '@/lib/auth/blog-auth';
import { deriveSharedCookieDomain } from '@/lib/auth/auth-cookies';

const isProduction = process.env.NODE_ENV === 'production';

function createCookieOptions(domain?: string) {
  return {
    domain,
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure: isProduction,
  };
}

export function setBlogAuthStateCookie(
  response: NextResponse,
  value: string,
  maxAgeSeconds: number
) {
  response.cookies.set(BLOG_AUTH_STATE_COOKIE, value, {
    ...createCookieOptions(),
    maxAge: maxAgeSeconds,
  });
}

export function clearBlogAuthStateCookie(response: NextResponse) {
  response.cookies.set(BLOG_AUTH_STATE_COOKIE, '', {
    ...createCookieOptions(),
    maxAge: 0,
  });
}

export function setBlogAuthTokenCookies({
  maxAgeSeconds,
  requestHeaders,
  response,
  token,
}: {
  maxAgeSeconds: number;
  requestHeaders?: {
    host?: string | string[] | undefined;
    'x-forwarded-host'?: string | string[] | undefined;
  };
  response: NextResponse;
  token: string;
}) {
  const domain = deriveSharedCookieDomain(
    requestHeaders ? { headers: requestHeaders } : undefined
  );
  const options = {
    ...createCookieOptions(domain),
    maxAge: maxAgeSeconds,
  };

  response.cookies.set(PAYLOAD_BETTER_AUTH_TOKEN_COOKIE, token, options);
  response.cookies.set(PAYLOAD_ADMIN_TOKEN_COOKIE, token, options);
}

export function clearBlogAuthTokenCookies(
  response: NextResponse,
  requestHeaders?: {
    host?: string | string[] | undefined;
    'x-forwarded-host'?: string | string[] | undefined;
  }
) {
  const domain = deriveSharedCookieDomain(
    requestHeaders ? { headers: requestHeaders } : undefined
  );
  const options = {
    ...createCookieOptions(domain),
    maxAge: 0,
  };

  response.cookies.set(PAYLOAD_BETTER_AUTH_TOKEN_COOKIE, '', options);
  response.cookies.set(PAYLOAD_ADMIN_TOKEN_COOKIE, '', options);
}
