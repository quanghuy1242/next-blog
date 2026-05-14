import { NextRequest } from 'next/server';

import { COMMENT_MAX_LENGTH } from '@/lib/constants/comments';
import { createComment, getComments } from '@/lib/payload/comments';
import {
  getAuthTokenFromNextRequest,
  getChapterProofFromNextRequest,
  methodNotAllowed,
  noStoreJson,
  parseJsonBody,
} from '@/lib/server/http';

export async function GET(request: NextRequest) {
  const chapterId = request.nextUrl.searchParams.get('chapterId')?.trim() || undefined;
  const postId = request.nextUrl.searchParams.get('postId')?.trim() || undefined;

  if ((!chapterId && !postId) || (chapterId && postId)) {
    return noStoreJson({ error: 'Provide exactly one of chapterId or postId.' }, { status: 400 });
  }

  const sessionToken = getAuthTokenFromNextRequest(request);
  const chapterPasswordProof = chapterId ? getChapterProofFromNextRequest(request) : null;

  try {
    const result = await getComments(
      { chapterId, postId },
      { authToken: sessionToken, chapterPasswordProof }
    );

    return noStoreJson(result);
  } catch (error) {
    console.error('Failed to fetch comments', error);
    return noStoreJson({ error: 'Failed to fetch comments.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const sessionToken = getAuthTokenFromNextRequest(request);

  if (!sessionToken) {
    return noStoreJson({ error: 'Authentication required.' }, { status: 401 });
  }

  const body = await parseJsonBody<Record<string, unknown>>(request);

  if (!body) {
    return noStoreJson({ error: 'Invalid request body.' }, { status: 400 });
  }

  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const chapterId = body.chapterId != null ? String(body.chapterId) : undefined;
  const postId = body.postId != null ? String(body.postId) : undefined;
  const parentCommentId = body.parentCommentId != null ? String(body.parentCommentId) : undefined;

  if (!content) {
    return noStoreJson({ error: 'content is required.' }, { status: 400 });
  }

  if (content.length > COMMENT_MAX_LENGTH) {
    return noStoreJson(
      { error: `content must be at most ${COMMENT_MAX_LENGTH} characters.` },
      { status: 400 }
    );
  }

  if ((!chapterId && !postId) || (chapterId && postId)) {
    return noStoreJson({ error: 'Provide exactly one of chapterId or postId.' }, { status: 400 });
  }

  const chapterPasswordProof = chapterId ? getChapterProofFromNextRequest(request) : null;

  try {
    const comment = await createComment(
      { chapterId, postId, content, parentCommentId },
      { authToken: sessionToken, chapterPasswordProof }
    );

    return noStoreJson({ comment });
  } catch (error) {
    console.error('Failed to create comment', error);
    return noStoreJson({ error: 'Failed to create comment.' }, { status: 500 });
  }
}

export function PUT() {
  return methodNotAllowed(['GET', 'POST']);
}
