import type { NextApiRequest, NextApiResponse } from 'next';
import { deleteBookmark } from 'common/apis/bookmarks';
import { getBetterAuthTokenFromRequest } from 'common/utils/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const sessionToken = getBetterAuthTokenFromRequest(req);

  if (!sessionToken) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const { bookmarkId } = req.query;
  const id = typeof bookmarkId === 'string' ? bookmarkId.trim() : '';

  if (!id) {
    res.status(400).json({ error: 'bookmarkId is required.' });
    return;
  }

  try {
    const result = await deleteBookmark(id, { authToken: sessionToken });
    res.status(200).json(result);
  } catch (error) {
    console.error('Failed to delete bookmark', error);
    res.status(500).json({ error: 'Failed to delete bookmark.' });
  }
}