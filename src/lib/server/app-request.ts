import { cookies, headers } from 'next/headers';

import { getBetterAuthTokenFromRequest } from '@/lib/auth/auth';
import { getChapterPasswordProofCookieValueFromRequest } from '@/lib/server/chapter-password-proof';

async function getAppRequestCookiesRecord() {
  const cookieStore = await cookies();
  const result: Record<string, string> = {};

  for (const cookie of cookieStore.getAll()) {
    result[cookie.name] = cookie.value;
  }

  return result;
}

async function getAppRequestHeadersRecord() {
  const headerStore = await headers();

  return {
    authorization: headerStore.get('authorization') ?? undefined,
    host: headerStore.get('host') ?? undefined,
    'x-forwarded-host': headerStore.get('x-forwarded-host') ?? undefined,
    'x-forwarded-proto': headerStore.get('x-forwarded-proto') ?? undefined,
  };
}

export async function getAuthTokenFromAppRequest() {
  return getBetterAuthTokenFromRequest({
    cookies: await getAppRequestCookiesRecord(),
    headers: {
      authorization: (await getAppRequestHeadersRecord()).authorization,
    },
  });
}

export async function getChapterProofFromAppRequest() {
  return getChapterPasswordProofCookieValueFromRequest({
    cookies: await getAppRequestCookiesRecord(),
  });
}
