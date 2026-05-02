import type { ServerResponse } from 'node:http';

import {
  PAYLOAD_ADMIN_TOKEN_COOKIE,
  PAYLOAD_BETTER_AUTH_TOKEN_COOKIE,
} from './auth';
import { BLOG_AUTH_STATE_COOKIE } from './blog-auth';

type CookieDomainRequestLike = {
  headers?: {
    host?: string | string[] | undefined;
    'x-forwarded-host'?: string | string[] | undefined;
  };
};

interface CookieOptions {
  domain?: string;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: 'lax' | 'strict' | 'none';
  secure?: boolean;
}

const isProduction = process.env.NODE_ENV === 'production';

const normalizeSingleHeaderValue = (
  value: string | string[] | undefined
): string | null => {
  if (Array.isArray(value)) {
    const first = value[0]?.trim();
    return first && first.length > 0 ? first : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
};

const deriveRegistrableDomain = (hostname: string): string | null => {
  const normalized = hostname.trim().toLowerCase();

  if (
    normalized.length === 0 ||
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.includes(':') ||
    /^[0-9.]+$/.test(normalized)
  ) {
    return null;
  }

  const parts = normalized.split('.').filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  return `.${parts.slice(-2).join('.')}`;
};

export const deriveSharedCookieDomain = (
  req?: CookieDomainRequestLike
): string | undefined => {
  const configured = process.env.AUTH_SHARED_COOKIE_DOMAIN?.trim();

  if (configured) {
    return configured;
  }

  const forwardedHost = normalizeSingleHeaderValue(req?.headers?.['x-forwarded-host']);
  const hostHeader = forwardedHost ?? normalizeSingleHeaderValue(req?.headers?.host);

  if (!hostHeader) {
    return undefined;
  }

  const hostname = hostHeader.split(':')[0] ?? hostHeader;
  const derivedDomain = deriveRegistrableDomain(hostname);

  return derivedDomain ?? undefined;
};

const serializeCookie = (name: string, value: string, options: CookieOptions): string => {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  if (typeof options.maxAge === 'number') {
    const maxAge = Math.max(0, Math.floor(options.maxAge));
    segments.push(`Max-Age=${maxAge}`);

    if (maxAge === 0) {
      segments.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    }
  }

  segments.push(`Path=${options.path ?? '/'}`);
  segments.push(`SameSite=${options.sameSite ?? 'Lax'}`);

  if (options.domain) {
    segments.push(`Domain=${options.domain}`);
  }

  if (options.httpOnly) {
    segments.push('HttpOnly');
  }

  if (options.secure) {
    segments.push('Secure');
  }

  return segments.join('; ');
};

const appendCookies = (res: ServerResponse, cookies: string[]): void => {
  const existing = res.getHeader('Set-Cookie');
  const normalizedExisting = Array.isArray(existing)
    ? existing.map(String)
    : typeof existing === 'string'
      ? [existing]
      : [];

  res.setHeader('Set-Cookie', [...normalizedExisting, ...cookies]);
};

const createBaseCookieOptions = (domain?: string): CookieOptions => ({
  domain,
  httpOnly: true,
  path: '/',
  sameSite: 'lax',
  secure: isProduction,
});

export const setBlogAuthStateCookie = (
  res: ServerResponse,
  value: string,
  maxAgeSeconds: number
): void => {
  appendCookies(res, [
    serializeCookie(BLOG_AUTH_STATE_COOKIE, value, {
      ...createBaseCookieOptions(),
      maxAge: maxAgeSeconds,
    }),
  ]);
};

export const clearBlogAuthStateCookie = (res: ServerResponse): void => {
  appendCookies(res, [
    serializeCookie(BLOG_AUTH_STATE_COOKIE, '', {
      ...createBaseCookieOptions(),
      maxAge: 0,
    }),
  ]);
};

export const setBlogAuthTokenCookies = ({
  maxAgeSeconds,
  req,
  res,
  token,
}: {
  maxAgeSeconds: number;
  req?: CookieDomainRequestLike;
  res: ServerResponse;
  token: string;
}): void => {
  const domain = deriveSharedCookieDomain(req);
  const options = {
    ...createBaseCookieOptions(domain),
    maxAge: maxAgeSeconds,
  };

  appendCookies(res, [
    serializeCookie(PAYLOAD_BETTER_AUTH_TOKEN_COOKIE, token, options),
    serializeCookie(PAYLOAD_ADMIN_TOKEN_COOKIE, token, options),
  ]);
};

export const clearBlogAuthTokenCookies = (
  res: ServerResponse,
  req?: CookieDomainRequestLike
): void => {
  const domain = deriveSharedCookieDomain(req);
  const options = {
    ...createBaseCookieOptions(domain),
    maxAge: 0,
  };

  appendCookies(res, [
    serializeCookie(PAYLOAD_BETTER_AUTH_TOKEN_COOKIE, '', options),
    serializeCookie(PAYLOAD_ADMIN_TOKEN_COOKIE, '', options),
  ]);
};
