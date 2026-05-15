import { NextRequest } from 'next/server';

import { AUTH_PAYLOAD_CACHE } from '@/lib/payload/cache';
import {
  getBookCardsViewerState,
  getBookDetailViewerState,
} from '@/lib/payload/book-viewer-state';
import { fetchPublicBookPagePayload } from '@/lib/payload/book-pages';
import { getAuthTokenFromNextRequest, methodNotAllowed, noStoreJson } from '@/lib/server/http';

const MAX_BOOK_IDS = 50;

export async function GET(request: NextRequest) {
  const sessionToken = getAuthTokenFromNextRequest(request);
  const parsedBookIds = parseBookIds(request.nextUrl.searchParams);

  if (!parsedBookIds.ok) {
    return noStoreJson({ error: parsedBookIds.error }, { status: 400 });
  }

  if (!sessionToken || parsedBookIds.bookIds.length === 0) {
    return noStoreJson({ books: [] });
  }

  const includeDetail = request.nextUrl.searchParams.get('detail') === '1';

  if (includeDetail && parsedBookIds.bookIds.length !== 1) {
    return noStoreJson(
      { error: 'detail=1 requires exactly one bookId.' },
      { status: 400 }
    );
  }

  try {
    const books = await getBookCardsViewerState(parsedBookIds.bookIds, {
      authToken: sessionToken,
      cache: AUTH_PAYLOAD_CACHE,
    });

    if (!includeDetail) {
      return noStoreJson({ books });
    }

    const basePayload = await fetchPublicBookPagePayload(parsedBookIds.bookIds[0], {
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

function parseBookIds(searchParams: URLSearchParams):
  | { ok: true; bookIds: number[] }
  | { ok: false; error: string } {
  const rawValues = [
    ...searchParams.getAll('bookId'),
    ...searchParams.getAll('bookIds'),
  ].flatMap((value) => value.split(','));

  const trimmedValues = rawValues
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (trimmedValues.length > MAX_BOOK_IDS) {
    return { ok: false, error: `At most ${MAX_BOOK_IDS} book IDs are allowed.` };
  }

  const bookIds = trimmedValues.map((value) => Number.parseInt(value, 10));

  if (bookIds.some((bookId) => !Number.isInteger(bookId) || bookId <= 0)) {
    return { ok: false, error: 'bookIds must contain positive integers.' };
  }

  return { ok: true, bookIds: Array.from(new Set(bookIds)) };
}
