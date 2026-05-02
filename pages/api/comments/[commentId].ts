import type { NextApiRequest, NextApiResponse } from 'next';
import { updateComment, deleteComment } from 'common/apis/comments';
import { COMMENT_MAX_LENGTH } from 'common/constants/comments';
import { getBetterAuthTokenFromRequest } from 'common/utils/auth';
import { getChapterPasswordProofCookieValueFromRequest } from 'common/utils/chapter-password-proof';

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
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'PATCH, DELETE');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const sessionToken = getBetterAuthTokenFromRequest(req);

  if (!sessionToken) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const { commentId } = req.query;
  const id = typeof commentId === 'string' ? commentId.trim() : '';

  if (!id) {
    res.status(400).json({ error: 'commentId is required.' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const chapterPasswordProof = getChapterPasswordProofCookieValueFromRequest(req);

  if (req.method === 'PATCH') {
    const body = parseJsonBody(req.body);

    if (!body) {
      res.status(400).json({ error: 'Invalid request body.' });
      return;
    }

    const content = typeof body?.content === 'string' ? body.content.trim() : '';

    if (!content) {
      res.status(400).json({ error: 'content is required.' });
      return;
    }

    if (content.length > COMMENT_MAX_LENGTH) {
      res.status(400).json({ error: `content must be at most ${COMMENT_MAX_LENGTH} characters.` });
      return;
    }

    try {
      const comment = await updateComment(id, content, {
        authToken: sessionToken,
        chapterPasswordProof,
      });
      res.status(200).json({ comment });
    } catch (error) {
      console.error('Failed to update comment', error);
      res.status(500).json({ error: 'Failed to update comment.' });
    }
    return;
  }

  if (req.method === 'DELETE') {
    try {
      const ok = await deleteComment(id, {
        authToken: sessionToken,
        chapterPasswordProof,
      });
      res.status(200).json({ ok });
    } catch (error) {
      console.error('Failed to delete comment', error);
      res.status(500).json({ error: 'Failed to delete comment.' });
    }
    return;
  }
}
