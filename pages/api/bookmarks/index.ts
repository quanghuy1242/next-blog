import type { NextApiRequest, NextApiResponse } from 'next';
import { getBookmarks, createBookmark } from 'common/apis/bookmarks';
import { getBetterAuthTokenFromRequest } from 'common/utils/auth';

function parseJsonBody(body: NextApiRequest['body']): Record<string, unknown> | null {
  if (body && typeof body === 'object') {
    return body as Record<string, unknown>;
  }

  if (typeof body !== 'string') {
    return null;
  }

  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'GET') {
    const sessionToken = getBetterAuthTokenFromRequest(req);

    if (!sessionToken) {
      res.status(200).json({ docs: [], totalDocs: 0 });
      return;
    }

    const contentType = typeof req.query.contentType === 'string' ? req.query.contentType : undefined;
    const contentId = typeof req.query.contentId === 'string' ? req.query.contentId : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
    const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : undefined;

    if ((contentType && !contentId) || (!contentType && contentId)) {
      res.status(400).json({ error: 'contentType and contentId must be provided together.' });
      return;
    }

    try {
      const result = await getBookmarks({
        authToken: sessionToken,
        contentType,
        contentId,
        limit,
        page,
      });

      res.status(200).json(result);
    } catch (error) {
      console.error('Failed to fetch bookmarks', error);
      res.status(500).json({ error: 'Failed to fetch bookmarks.' });
    }
    return;
  }

  if (req.method === 'POST') {
    const sessionToken = getBetterAuthTokenFromRequest(req);

    if (!sessionToken) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const body = parseJsonBody(req.body);

    if (!body) {
      res.status(400).json({ error: 'Invalid request body.' });
      return;
    }

    const contentType = typeof body?.contentType === 'string' ? body.contentType : '';
    const chapterId = body?.chapterId != null ? String(body.chapterId) : undefined;
    const bookId = body?.bookId != null ? String(body.bookId) : undefined;

    if (!contentType || (contentType !== 'chapter' && contentType !== 'book')) {
      res.status(400).json({ error: 'contentType must be "chapter" or "book".' });
      return;
    }

    if (contentType === 'chapter' && !chapterId) {
      res.status(400).json({ error: 'chapterId is required for chapter bookmarks.' });
      return;
    }

    if (contentType === 'chapter' && bookId) {
      res.status(400).json({ error: 'bookId is not allowed for chapter bookmarks.' });
      return;
    }

    if (contentType === 'book' && !bookId) {
      res.status(400).json({ error: 'bookId is required for book bookmarks.' });
      return;
    }

    if (contentType === 'book' && chapterId) {
      res.status(400).json({ error: 'chapterId is not allowed for book bookmarks.' });
      return;
    }

    try {
      const result = await createBookmark(
        { contentType, chapterId, bookId },
        { authToken: sessionToken }
      );

      res.status(200).json(result);
    } catch (error) {
      console.error('Failed to create bookmark', error);
      res.status(500).json({ error: 'Failed to create bookmark.' });
    }
    return;
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).json({ error: 'Method Not Allowed' });
}
