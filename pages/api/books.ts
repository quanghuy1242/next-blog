import type { NextApiRequest, NextApiResponse } from 'next';
import { getPaginatedBooks } from 'common/apis/books';
import { AUTH_PAYLOAD_CACHE, ONE_HOUR_PAYLOAD_CACHE } from 'common/apis/cache';
import { getBetterAuthTokenFromRequest } from 'common/utils/auth';
import { normalizeLimit, normalizeOffset } from 'common/utils/number';

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 50;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const limit = normalizeLimit(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const offset = normalizeOffset(req.query.offset);
  const sessionToken = getBetterAuthTokenFromRequest(req);
  const payloadCache = sessionToken ? AUTH_PAYLOAD_CACHE : ONE_HOUR_PAYLOAD_CACHE;

  try {
    const { books, hasMore } = await getPaginatedBooks({
      limit,
      skip: offset,
    }, {
      authToken: sessionToken,
      cache: payloadCache,
    });

    res.status(200).json({
      books,
      hasMore,
      nextOffset: offset + books.length,
    });
  } catch (error) {
    console.error('Failed to fetch paginated books', error);
    res.status(500).json({ error: 'Failed to load books' });
  }
}
