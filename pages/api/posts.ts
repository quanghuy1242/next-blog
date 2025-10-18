import type { NextApiRequest, NextApiResponse } from 'next';
import { getPaginatedPosts } from 'common/apis/posts';

const DEFAULT_LIMIT = 5;
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

  const limit = normalizeLimit(req.query.limit);
  const offset = normalizeOffset(req.query.offset);

  try {
    const { posts, hasMore } = await getPaginatedPosts({
      limit,
      skip: offset,
    });

    res.status(200).json({
      posts,
      hasMore,
      nextOffset: offset + posts.length,
    });
  } catch (error) {
    console.error('Failed to fetch paginated posts', error);
    res.status(500).json({ error: 'Failed to load posts' });
  }
}

function normalizeLimit(value: unknown): number {
  const parsed = Number.parseInt(stringifyValue(value), 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

function normalizeOffset(value: unknown): number {
  const parsed = Number.parseInt(stringifyValue(value), 10);

  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function stringifyValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value?.toString() ?? '';
}
