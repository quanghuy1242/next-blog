import { NextRequest } from 'next/server';

import { getChapterViewerState } from '@/lib/payload/books/viewer-state';
import { getAuthTokenFromNextRequest, methodNotAllowed, noStoreJson } from '@/lib/server/http';
import { parsePositiveInteger } from '@/lib/shared/number';

/**
 * Mutable authenticated state endpoint for the reader chrome.
 *
 * Chapter content is served by the route loader; this endpoint only supplies live
 * bookmark/progress data that can hydrate after the article is already visible.
 */
export async function GET(request: NextRequest) {
  const sessionToken = getAuthTokenFromNextRequest(request);
  const bookIdResult = parsePositiveInteger(request.nextUrl.searchParams.get('bookId'), 'bookId');
  const chapterIdResult = parsePositiveInteger(
    request.nextUrl.searchParams.get('chapterId'),
    'chapterId'
  );

  if (!bookIdResult.ok) {
    return noStoreJson({ error: bookIdResult.error }, { status: 400 });
  }

  if (!chapterIdResult.ok) {
    return noStoreJson({ error: chapterIdResult.error }, { status: 400 });
  }

  if (!sessionToken) {
    return noStoreJson({
      bookmark: null,
      readingProgress: [],
    });
  }

  try {
    const viewerState = await getChapterViewerState(bookIdResult.value, chapterIdResult.value, {
      authToken: sessionToken,
    });

    return noStoreJson(viewerState);
  } catch (error) {
    console.error('Failed to fetch chapter viewer state', error);
    return noStoreJson({ error: 'Failed to load chapter viewer state.' }, { status: 500 });
  }
}

export function POST() {
  return methodNotAllowed(['GET']);
}
