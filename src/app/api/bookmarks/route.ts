import { NextRequest } from 'next/server';

import { createBookmark, getBookmarks } from '@/lib/payload/bookmarks';
import {
  getAuthTokenFromNextRequest,
  methodNotAllowed,
  noStoreJson,
  parseJsonBody,
} from '@/lib/server/http';

export async function GET(request: NextRequest) {
  const sessionToken = getAuthTokenFromNextRequest(request);

  if (!sessionToken) {
    return noStoreJson({ docs: [], totalDocs: 0 });
  }

  const contentType = request.nextUrl.searchParams.get('contentType')?.trim() || undefined;
  const contentId = request.nextUrl.searchParams.get('contentId')?.trim() || undefined;
  const limitValue = request.nextUrl.searchParams.get('limit');
  const pageValue = request.nextUrl.searchParams.get('page');
  const limit = limitValue ? Number.parseInt(limitValue, 10) : undefined;
  const page = pageValue ? Number.parseInt(pageValue, 10) : undefined;

  if ((contentType && !contentId) || (!contentType && contentId)) {
    return noStoreJson(
      { error: 'contentType and contentId must be provided together.' },
      { status: 400 }
    );
  }

  try {
    const result = await getBookmarks({
      authToken: sessionToken,
      contentType,
      contentId,
      limit,
      page,
    });

    return noStoreJson(result);
  } catch (error) {
    console.error('Failed to fetch bookmarks', error);
    return noStoreJson({ error: 'Failed to fetch bookmarks.' }, { status: 500 });
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

  const contentType = typeof body.contentType === 'string' ? body.contentType : '';
  const chapterId = body.chapterId != null ? String(body.chapterId) : undefined;
  const bookId = body.bookId != null ? String(body.bookId) : undefined;

  if (!contentType || (contentType !== 'chapter' && contentType !== 'book')) {
    return noStoreJson({ error: 'contentType must be "chapter" or "book".' }, { status: 400 });
  }

  if (contentType === 'chapter' && !chapterId) {
    return noStoreJson({ error: 'chapterId is required for chapter bookmarks.' }, { status: 400 });
  }

  if (contentType === 'chapter' && bookId) {
    return noStoreJson({ error: 'bookId is not allowed for chapter bookmarks.' }, { status: 400 });
  }

  if (contentType === 'book' && !bookId) {
    return noStoreJson({ error: 'bookId is required for book bookmarks.' }, { status: 400 });
  }

  if (contentType === 'book' && chapterId) {
    return noStoreJson({ error: 'chapterId is not allowed for book bookmarks.' }, { status: 400 });
  }

  try {
    const result = await createBookmark(
      { contentType, chapterId, bookId },
      { authToken: sessionToken }
    );

    return noStoreJson(result);
  } catch (error) {
    console.error('Failed to create bookmark', error);
    return noStoreJson({ error: 'Failed to create bookmark.' }, { status: 500 });
  }
}

export function DELETE() {
  return methodNotAllowed(['GET', 'POST']);
}
