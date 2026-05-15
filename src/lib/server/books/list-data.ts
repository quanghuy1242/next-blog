import 'server-only';

import { getDataForBooksPage } from '@/lib/payload/books/catalog';
import { AUTH_PAYLOAD_CACHE, ONE_HOUR_PAYLOAD_CACHE } from '@/lib/payload/core/cache';
import { getAuthTokenFromAppRequest } from '@/lib/server/app-request';

const BOOKS_PAGE_SIZE = 6;

export async function getBooksListPageData() {
  const sessionToken = await getAuthTokenFromAppRequest();
  const payloadCache = sessionToken ? AUTH_PAYLOAD_CACHE : ONE_HOUR_PAYLOAD_CACHE;
  const data = await getDataForBooksPage(BOOKS_PAGE_SIZE, {
    authToken: sessionToken,
    cache: payloadCache,
    includeViewerState: false,
  });

  return {
    ...data,
    isAuthenticated: Boolean(sessionToken),
  };
}
