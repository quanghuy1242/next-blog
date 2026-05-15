import { NextRequest } from 'next/server';

import { getPaginatedBooks } from '@/lib/payload/books';
import { AUTH_PAYLOAD_CACHE, ONE_HOUR_PAYLOAD_CACHE } from '@/lib/payload/cache';
import { getAuthTokenFromNextRequest, json, methodNotAllowed, noStoreJson } from '@/lib/server/http';
import { normalizeLimit, normalizeOffset } from '@/lib/utils/number';

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  const limit = normalizeLimit(request.nextUrl.searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT);
  const offset = normalizeOffset(request.nextUrl.searchParams.get('offset'));
  const sessionToken = getAuthTokenFromNextRequest(request);
  const payloadCache = sessionToken ? AUTH_PAYLOAD_CACHE : ONE_HOUR_PAYLOAD_CACHE;

  try {
    const { books, hasMore } = await getPaginatedBooks(
      { limit, skip: offset },
      { authToken: sessionToken, cache: payloadCache, includeViewerState: false }
    );

    const payload = {
      books,
      hasMore,
      nextOffset: offset + books.length,
    };

    return sessionToken ? noStoreJson(payload) : json(payload);
  } catch (error) {
    console.error('Failed to fetch paginated books', error);
    return json({ error: 'Failed to load books' }, { status: 500 });
  }
}

export function POST() {
  return methodNotAllowed(['GET']);
}
