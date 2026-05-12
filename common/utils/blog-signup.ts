import { getAuthBaseUrl, getRuntimeOrigin, normalizeReturnTo } from './blog-auth';

interface RuntimeRequestLike {
  headers?: {
    host?: string | string[] | undefined;
    'x-forwarded-host'?: string | string[] | undefined;
    'x-forwarded-proto'?: string | string[] | undefined;
  };
}

interface RequestedSignupGrant {
  entityTypeId: string;
  relation: string;
  entityId?: string;
}

export interface BlogSignupIntentInput {
  returnTo: string;
  req?: RuntimeRequestLike;
}

export interface BlogSignupIntentResult {
  signupUrl: string;
}

const getRequiredServerEnv = (name: string): string => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
};

export const getBlogSignupFlowSlug = (): string => {
  return getRequiredServerEnv('BLOG_SIGNUP_FLOW_SLUG');
};

export const getBlogSignupAuthorizationSpaceId = (): string => {
  return getRequiredServerEnv('BLOG_SIGNUP_AUTHORIZATION_SPACE_ID');
};

export const getBlogSignupTriggerKind = (): 'oauth_client' | 'resource_server' => {
  const value = process.env.BLOG_SIGNUP_TRIGGER_KIND?.trim() || 'oauth_client';

  if (value !== 'oauth_client' && value !== 'resource_server') {
    throw new Error('BLOG_SIGNUP_TRIGGER_KIND must be oauth_client or resource_server.');
  }

  return value;
};

export const getBlogSignupTriggerClientId = (): string => {
  return getRequiredServerEnv('BLOG_SIGNUP_TRIGGER_CLIENT_ID');
};

const getBlogSignupTriggerClientSecret = (): string => {
  return getRequiredServerEnv('BLOG_SIGNUP_TRIGGER_CLIENT_SECRET');
};

export const getBlogSignupIntentTtlSeconds = (): number | undefined => {
  const value = process.env.BLOG_SIGNUP_INTENT_TTL_SECONDS?.trim();

  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('BLOG_SIGNUP_INTENT_TTL_SECONDS must be a positive number.');
  }

  return Math.floor(parsed);
};

export const getBlogSignupRequestedGrants = (): RequestedSignupGrant[] | undefined => {
  const entityTypeId = process.env.BLOG_SIGNUP_REQUESTED_ENTITY_TYPE_ID?.trim();
  const relation = process.env.BLOG_SIGNUP_REQUESTED_RELATION?.trim();
  const entityId = process.env.BLOG_SIGNUP_REQUESTED_ENTITY_ID?.trim();

  if (!entityTypeId && !relation && !entityId) {
    return undefined;
  }

  if (!entityTypeId || !relation) {
    throw new Error(
      'BLOG_SIGNUP_REQUESTED_ENTITY_TYPE_ID and BLOG_SIGNUP_REQUESTED_RELATION are required when requesting a grant subset.'
    );
  }

  return [
    {
      entityTypeId,
      relation,
      ...(entityId ? { entityId } : {}),
    },
  ];
};

export const buildBlogSignupContinuationUrl = (
  returnTo: string,
  req?: RuntimeRequestLike
): string => {
  const normalizedReturnTo = normalizeReturnTo(returnTo);
  const url = new URL('/auth/login', getRuntimeOrigin(req));
  url.searchParams.set('returnTo', normalizedReturnTo);
  return url.toString();
};

export const createBlogSignupIntent = async ({
  returnTo,
  req,
}: BlogSignupIntentInput): Promise<BlogSignupIntentResult> => {
  const triggerKind = getBlogSignupTriggerKind();
  const triggerId = getBlogSignupTriggerClientId();
  const triggerSecret = getBlogSignupTriggerClientSecret();
  const url = new URL('/api/auth/signup-intents', getAuthBaseUrl());
  const body: Record<string, unknown> = {
    flow: getBlogSignupFlowSlug(),
    authorizationSpaceId: getBlogSignupAuthorizationSpaceId(),
    trigger: {
      kind: triggerKind,
      id: triggerId,
    },
    returnUrl: buildBlogSignupContinuationUrl(returnTo, req),
  };
  const expiresInSeconds = getBlogSignupIntentTtlSeconds();
  const requestedGrants = getBlogSignupRequestedGrants();

  if (typeof expiresInSeconds === 'number') {
    body.expiresInSeconds = expiresInSeconds;
  }

  if (requestedGrants) {
    body.requestedGrants = requestedGrants;
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${triggerId}:${triggerSecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Signup intent request failed with status ${response.status}.`);
  }

  const json = (await response.json()) as { signupUrl?: unknown };

  if (typeof json.signupUrl !== 'string' || json.signupUrl.trim().length === 0) {
    throw new Error('Signup intent response did not include a signupUrl.');
  }

  const signupUrl = new URL(json.signupUrl);
  const authOrigin = new URL(getAuthBaseUrl()).origin;

  if (signupUrl.origin !== authOrigin || signupUrl.pathname !== '/sign-up') {
    throw new Error('Signup intent response included an invalid signupUrl.');
  }

  return {
    signupUrl: signupUrl.toString(),
  };
};
