import { NextRequest } from 'next/server';

import { AUTH_PAYLOAD_CACHE } from '@/lib/payload/core/cache';
import {
  getBookCardsViewerState,
  getBookDetailViewerState,
} from '@/lib/payload/books/viewer-state';
import { fetchPublicBookPagePayload } from '@/lib/payload/books/pages';
import { getAuthTokenFromNextRequest, methodNotAllowed, noStoreJson } from '@/lib/server/http';
import { parseDelimitedPositiveIntegers } from '@/lib/utils/number';

const MAX_BOOK_IDS = 50;

/**
 * Mutable authenticated state endpoint for book UI.
 *
 * Keep this no-store and separate from `/api/books`. The list/detail pages should
 * render base content first, then call this endpoint for per-user badges, bookmarks,
 * whole-book progress, and continue-reading data.
 */
export async function GET(request: NextRequest) {
  const sessionToken = getAuthTokenFromNextRequest(request);
  const parsedBookIds = parseDelimitedPositiveIntegers(
    request.nextUrl.searchParams,
    ['bookId', 'bookIds'],
    { errorName: 'bookIds', maxErrorName: 'book IDs', maxValues: MAX_BOOK_IDS }
  );

  if (!parsedBookIds.ok) {
    return noStoreJson({ error: parsedBookIds.error }, { status: 400 });
  }

  if (!sessionToken || parsedBookIds.values.length === 0) {
    return noStoreJson({ books: [] });
  }

  const includeDetail = request.nextUrl.searchParams.get('detail') === '1';

  if (includeDetail && parsedBookIds.values.length !== 1) {
    return noStoreJson(
      { error: 'detail=1 requires exactly one bookId.' },
      { status: 400 }
    );
  }

  try {
    const books = await getBookCardsViewerState(parsedBookIds.values, {
      authToken: sessionToken,
      cache: AUTH_PAYLOAD_CACHE,
    });

    if (!includeDetail) {
      return noStoreJson({ books });
    }

    const basePayload = await fetchPublicBookPagePayload(parsedBookIds.values[0], {
      authToken: sessionToken,
      cache: AUTH_PAYLOAD_CACHE,
    });

    if (!basePayload.book) {
      return noStoreJson({ books, detail: null });
    }

    const detail = await getBookDetailViewerState(
      basePayload.book,
      basePayload.chapters,
      { authToken: sessionToken }
    );

    return noStoreJson({ books, detail });
  } catch (error) {
    console.error('Failed to fetch books viewer state', error);
    return noStoreJson({ error: 'Failed to load books viewer state.' }, { status: 500 });
  }
}

export function POST() {
  return methodNotAllowed(['GET']);
}
