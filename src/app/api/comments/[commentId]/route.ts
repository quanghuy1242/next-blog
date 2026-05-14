import { NextRequest } from 'next/server';

import { COMMENT_MAX_LENGTH } from '@/lib/constants/comments';
import { deleteComment, updateComment } from '@/lib/payload/comments';
import {
  getAuthTokenFromNextRequest,
  getChapterProofFromNextRequest,
  methodNotAllowed,
  noStoreJson,
  parseJsonBody,
} from '@/lib/server/http';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const sessionToken = getAuthTokenFromNextRequest(request);

  if (!sessionToken) {
    return noStoreJson({ error: 'Authentication required.' }, { status: 401 });
  }

  const { commentId } = await params;
  const id = commentId?.trim();

  if (!id) {
    return noStoreJson({ error: 'commentId is required.' }, { status: 400 });
  }

  const body = await parseJsonBody<Record<string, unknown>>(request);

  if (!body) {
    return noStoreJson({ error: 'Invalid request body.' }, { status: 400 });
  }

  const content = typeof body.content === 'string' ? body.content.trim() : '';

  if (!content) {
    return noStoreJson({ error: 'content is required.' }, { status: 400 });
  }

  if (content.length > COMMENT_MAX_LENGTH) {
    return noStoreJson(
      { error: `content must be at most ${COMMENT_MAX_LENGTH} characters.` },
      { status: 400 }
    );
  }

  try {
    const comment = await updateComment(id, content, {
      authToken: sessionToken,
      chapterPasswordProof: getChapterProofFromNextRequest(request),
    });

    return noStoreJson({ comment });
  } catch (error) {
    console.error('Failed to update comment', error);
    return noStoreJson({ error: 'Failed to update comment.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const sessionToken = getAuthTokenFromNextRequest(request);

  if (!sessionToken) {
    return noStoreJson({ error: 'Authentication required.' }, { status: 401 });
  }

  const { commentId } = await params;
  const id = commentId?.trim();

  if (!id) {
    return noStoreJson({ error: 'commentId is required.' }, { status: 400 });
  }

  try {
    const ok = await deleteComment(id, {
      authToken: sessionToken,
      chapterPasswordProof: getChapterProofFromNextRequest(request),
    });

    return noStoreJson({ ok });
  } catch (error) {
    console.error('Failed to delete comment', error);
    return noStoreJson({ error: 'Failed to delete comment.' }, { status: 500 });
  }
}

export function GET() {
  return methodNotAllowed(['PATCH', 'DELETE']);
}
