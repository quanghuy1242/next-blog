import type { NextApiRequest, NextApiResponse } from 'next';
import { getComments, createComment } from 'common/apis/comments';
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
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'GET') {
    const chapterId = typeof req.query.chapterId === 'string' ? req.query.chapterId : undefined;
    const postId = typeof req.query.postId === 'string' ? req.query.postId : undefined;

    if ((!chapterId && !postId) || (chapterId && postId)) {
      res.status(400).json({ error: 'Provide exactly one of chapterId or postId.' });
      return;
    }

    const sessionToken = getBetterAuthTokenFromRequest(req);
    const chapterPasswordProof = chapterId
      ? getChapterPasswordProofCookieValueFromRequest(req)
      : null;

    try {
      const result = await getComments(
        { chapterId, postId },
        { authToken: sessionToken, chapterPasswordProof }
      );

      res.status(200).json(result);
    } catch (error) {
      console.error('Failed to fetch comments', error);
      res.status(500).json({ error: 'Failed to fetch comments.' });
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

    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    const chapterId = body?.chapterId != null ? String(body.chapterId) : undefined;
    const postId = body?.postId != null ? String(body.postId) : undefined;
    const parentCommentId = body?.parentCommentId != null ? String(body.parentCommentId) : undefined;

    if (!content) {
      res.status(400).json({ error: 'content is required.' });
      return;
    }

    if (content.length > COMMENT_MAX_LENGTH) {
      res.status(400).json({ error: `content must be at most ${COMMENT_MAX_LENGTH} characters.` });
      return;
    }

    if ((!chapterId && !postId) || (chapterId && postId)) {
      res.status(400).json({ error: 'Provide exactly one of chapterId or postId.' });
      return;
    }

    const chapterPasswordProof = chapterId
      ? getChapterPasswordProofCookieValueFromRequest(req)
      : null;

    try {
      const comment = await createComment(
        { chapterId, postId, content, parentCommentId },
        { authToken: sessionToken, chapterPasswordProof }
      );

      res.status(200).json({ comment });
    } catch (error) {
      console.error('Failed to create comment', error);
      res.status(500).json({ error: 'Failed to create comment.' });
    }
    return;
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).json({ error: 'Method Not Allowed' });
}
