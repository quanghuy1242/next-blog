import type { NextApiRequest, NextApiResponse } from 'next';
import { saveReadingProgress } from 'common/apis/reading-progress';
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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store, max-age=0');

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

  const chapterId = typeof body?.chapterId === 'number' || typeof body?.chapterId === 'string'
    ? String(body.chapterId)
    : '';
  const bookId = typeof body?.bookId === 'number' || typeof body?.bookId === 'string'
    ? String(body.bookId)
    : '';
  const progress = typeof body?.progress === 'number' ? body.progress : NaN;

  if (!chapterId || !bookId) {
    res.status(400).json({ error: 'chapterId and bookId are required.' });
    return;
  }

  if (isNaN(progress) || progress < 0 || progress > 100) {
    res.status(400).json({ error: 'progress must be a number between 0 and 100.' });
    return;
  }

  try {
    const result = await saveReadingProgress(chapterId, bookId, progress, {
      authToken: sessionToken,
    });

    if (!result.ok) {
      res.status(404).json({ error: 'Chapter or book was not found.' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Failed to save reading progress', error);
    res.status(500).json({ error: 'Failed to save reading progress.' });
  }
}
