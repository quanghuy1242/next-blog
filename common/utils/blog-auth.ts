import crypto from 'node:crypto';

export const BLOG_AUTH_STATE_COOKIE = 'blogAuthState' as const;
export const BLOG_AUTH_SCOPE = 'openid email profile' as const;
export const BLOG_AUTH_COOKIE_MAX_AGE_SECONDS = 10 * 60;
export const BLOG_TOKEN_COOKIE_MAX_AGE_SECONDS = 2 * 24 * 60 * 60;
export const BLOG_AUTH_THEME = 'blog' as const;

export interface BlogAuthStatePayload {
  createdAt: number;
  returnTo: string;
  state: string;
  verifier: string;
}

interface RuntimeRequestLike {
  headers?: {
    host?: string | string[] | undefined;
    'x-forwarded-host'?: string | string[] | undefined;
    'x-forwarded-proto'?: string | string[] | undefined;
  };
}

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

export const getAuthBaseUrl = (): string => {
  const value = process.env.AUTH_BASE_URL?.trim();

  if (!value) {
    throw new Error('AUTH_BASE_URL is required.');
  }

  return value.replace(/\/+$/, '');
};

export const getBlogClientId = (): string => {
  const value = process.env.BLOG_CLIENT_ID?.trim();

  if (!value) {
    throw new Error('BLOG_CLIENT_ID is required.');
  }

  return value;
};

export const getBlogRedirectUri = (): string => {
  const value = process.env.BLOG_REDIRECT_URI?.trim();

  if (!value) {
    throw new Error('BLOG_REDIRECT_URI is required.');
  }

  return value;
};

export const getBlogPostLogoutRedirectUri = (
  req?: RuntimeRequestLike
): string => {
  const configured = process.env.BLOG_POST_LOGOUT_REDIRECT_URI?.trim();

  if (configured) {
    return configured;
  }

  return getRuntimeOrigin(req);
};

export const normalizeReturnTo = (value: string | string[] | undefined): string => {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate || typeof candidate !== 'string') {
    return '/';
  }

  const trimmed = candidate.trim();

  if (!trimmed.startsWith('/')) {
    return '/';
  }

  if (trimmed.startsWith('//')) {
    return '/';
  }

  return trimmed.length > 0 ? trimmed : '/';
};

export const createCodeVerifier = (): string => {
  return crypto.randomBytes(32).toString('base64url');
};

export const createCodeChallenge = (verifier: string): string => {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
};

export const createBlogAuthStatePayload = (
  returnTo: string
): BlogAuthStatePayload => {
  return {
    createdAt: Date.now(),
    returnTo: normalizeReturnTo(returnTo),
    state: crypto.randomUUID(),
    verifier: createCodeVerifier(),
  };
};

export const encodeBlogAuthStatePayload = (
  payload: BlogAuthStatePayload
): string => {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
};

export const decodeBlogAuthStatePayload = (
  value: string | null | undefined
): BlogAuthStatePayload | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8')
    ) as Partial<BlogAuthStatePayload>;

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.createdAt !== 'number' ||
      typeof parsed.returnTo !== 'string' ||
      typeof parsed.state !== 'string' ||
      typeof parsed.verifier !== 'string'
    ) {
      return null;
    }

    return {
      createdAt: parsed.createdAt,
      returnTo: normalizeReturnTo(parsed.returnTo),
      state: parsed.state,
      verifier: parsed.verifier,
    };
  } catch {
    return null;
  }
};

export const isBlogAuthStateExpired = (
  payload: BlogAuthStatePayload,
  now: number = Date.now()
): boolean => {
  return (now - payload.createdAt) / 1000 > BLOG_AUTH_COOKIE_MAX_AGE_SECONDS;
};

export const buildAuthorizeUrl = (
  payload: BlogAuthStatePayload
): string => {
  const authorizeUrl = new URL('/api/auth/oauth2/authorize', getAuthBaseUrl());
  authorizeUrl.searchParams.set('client_id', getBlogClientId());
  authorizeUrl.searchParams.set('redirect_uri', getBlogRedirectUri());
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', BLOG_AUTH_SCOPE);
  authorizeUrl.searchParams.set('state', payload.state);
  authorizeUrl.searchParams.set('code_challenge', createCodeChallenge(payload.verifier));
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('theme', BLOG_AUTH_THEME);

  return authorizeUrl.toString();
};

export interface TokenExchangeSuccess {
  accessToken: string | null;
  expiresIn: number | null;
  idToken: string;
}

export const exchangeAuthorizationCode = async ({
  code,
  verifier,
}: {
  code: string;
  verifier: string;
}): Promise<TokenExchangeSuccess> => {
  const tokenUrl = new URL('/api/auth/oauth2/token', getAuthBaseUrl());
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: getBlogClientId(),
    code,
    redirect_uri: getBlogRedirectUri(),
    code_verifier: verifier,
  });

  const response = await fetch(tokenUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed with status ${response.status}.`);
  }

  const json = (await response.json()) as {
    access_token?: unknown;
    expires_in?: unknown;
    id_token?: unknown;
  };

  if (typeof json.id_token !== 'string' || json.id_token.trim().length === 0) {
    throw new Error('Token exchange did not return an id_token.');
  }

  return {
    accessToken:
      typeof json.access_token === 'string' && json.access_token.trim().length > 0
        ? json.access_token
        : null,
    expiresIn:
      typeof json.expires_in === 'number' && Number.isFinite(json.expires_in)
        ? Math.max(1, Math.floor(json.expires_in))
        : null,
    idToken: json.id_token,
  };
};

export const getTokenCookieMaxAgeSeconds = (expiresIn: number | null): number => {
  if (!expiresIn || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    return BLOG_TOKEN_COOKIE_MAX_AGE_SECONDS;
  }

  return Math.min(Math.floor(expiresIn), BLOG_TOKEN_COOKIE_MAX_AGE_SECONDS);
};

export const getRuntimeOrigin = (req?: RuntimeRequestLike): string => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }

  const forwardedHost = normalizeSingleHeaderValue(req?.headers?.['x-forwarded-host']);
  const host = forwardedHost ?? normalizeSingleHeaderValue(req?.headers?.host);
  const forwardedProto =
    normalizeSingleHeaderValue(req?.headers?.['x-forwarded-proto']) ?? 'http';

  if (host) {
    return `${forwardedProto}://${host}`;
  }

  return 'http://localhost:3000';
};
