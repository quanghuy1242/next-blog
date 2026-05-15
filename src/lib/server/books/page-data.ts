import 'server-only';

import { draftMode } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import type {
  Book,
  BookmarkRecord,
  Chapter,
  CommentsResult,
  ReadingProgressRecord,
} from '@/types/cms';
import { getBookBySlug } from '@/lib/payload/books/catalog';
import { AUTH_PAYLOAD_CACHE, ONE_HOUR_PAYLOAD_CACHE, type PayloadCacheSettings } from '@/lib/payload/core/cache';
import { getChapterByBookAndSlug } from '@/lib/payload/books/chapters';
import {
  fetchChapterPageBasePayload,
  fetchPublicBookPagePayload,
  type PayloadBookPageRequestOptions,
  type PayloadChapterPageRequestOptions,
} from '@/lib/payload/books/pages';
import {
  buildBookHref,
  buildChapterHref,
  parseBookRouteSegment,
} from '@/lib/domain/books/routes';
import {
  getAuthTokenFromAppRequest,
  getChapterProofFromAppRequest,
} from '@/lib/server/app-request';

interface PageRequestContext {
  sessionToken: string | null;
  isDraftMode: boolean;
  payloadCache?: PayloadCacheSettings;
}

interface ChapterPageRequestContext extends PageRequestContext {
  chapterPasswordProof: string | null;
}

export interface BookPageData {
  book: Book;
  chapters: Chapter[];
  initialBookmark?: BookmarkRecord | null;
  isAuthenticated: boolean;
  isDraftMode: boolean;
  readingProgress: ReadingProgressRecord[];
  readingProgressByChapterId?: Record<number, number>;
  continueReadingChapterSlug: string | null;
  wholeBookProgress: number;
}

export interface ChapterPageData {
  book: Book;
  chapter: Chapter;
  chapters: Chapter[];
  initialComments: CommentsResult | null;
  initialBookmark?: BookmarkRecord | null;
  isAuthenticated: boolean;
  isDraftMode: boolean;
  readingProgress: ReadingProgressRecord[];
}

/**
 * Book and chapter page loaders intentionally return base content only.
 *
 * Authenticated viewer state such as bookmarks, reading progress, continue-reading,
 * and comments is fetched after render by the client-side viewer-state layer. Do not
 * move those live reads back into these loaders unless the route truly cannot render
 * without them; doing so makes signed-in readers wait on mutable per-user roundtrips.
 */
export async function getBookPageMetadataData(slugParam: string): Promise<{ book: Book }> {
  const requestContext = await getPageRequestContext();
  const parsedBookRoute = parseBookRouteSegment(slugParam);

  if (!parsedBookRoute.bookId) {
    await redirectLegacyBookSlug(parsedBookRoute.bookSlug, requestContext);
  }

  const basePayload = await fetchPublicBookPagePayload(
    parsedBookRoute.bookId!,
    toPayloadOptions(requestContext)
  );
  const book = basePayload.book;

  if (!book || book.slug !== parsedBookRoute.bookSlug) {
    notFound();
  }

  return { book };
}

/**
 * Returns the cache-friendly book shell. Viewer-specific fields stay empty on purpose
 * and are hydrated by `BookPageClient` from local snapshots plus `/api/books/viewer-state`.
 */
export async function getBookPageData(slugParam: string): Promise<BookPageData> {
  const requestContext = await getPageRequestContext();
  const parsedBookRoute = parseBookRouteSegment(slugParam);

  if (!parsedBookRoute.bookId) {
    await redirectLegacyBookSlug(parsedBookRoute.bookSlug, requestContext);
  }

  const basePayload = await fetchPublicBookPagePayload(
    parsedBookRoute.bookId!,
    toPayloadOptions(requestContext)
  );
  const book = basePayload.book;
  const chapters = basePayload.chapters;

  if (!book || book.slug !== parsedBookRoute.bookSlug) {
    notFound();
  }

  return {
    book,
    chapters,
    continueReadingChapterSlug: null,
    initialBookmark: undefined,
    isAuthenticated: requestContext.sessionToken != null,
    isDraftMode: requestContext.isDraftMode,
    readingProgress: [],
    readingProgressByChapterId: undefined,
    wholeBookProgress: 0,
  };
}

/**
 * Metadata can still use the base chapter payload because SEO data is content-owned,
 * not viewer-owned.
 */
export async function getChapterPageMetadataData(
  bookSlugParam: string,
  chapterSlug: string
): Promise<{ book: Book; chapter: Chapter }> {
  const requestContext = await getChapterPageRequestContext();
  const parsedBookRoute = parseBookRouteSegment(bookSlugParam);

  if (!parsedBookRoute.bookId) {
    await redirectLegacyChapterRoute(parsedBookRoute.bookSlug, chapterSlug, requestContext);
  }

  const { book, chapter } = await fetchChapterPageBaseData(
    parsedBookRoute.bookId!,
    chapterSlug,
    requestContext
  );

  if (!book || !chapter || book.slug !== parsedBookRoute.bookSlug) {
    notFound();
  }

  return { book, chapter };
}

/**
 * Returns chapter content without waiting for bookmark/progress/comment state.
 * `ChapterReaderClient` owns those live reads so the article body can appear first.
 */
export async function getChapterPageData(
  bookSlugParam: string,
  chapterSlug: string
): Promise<ChapterPageData> {
  const requestContext = await getChapterPageRequestContext();
  const parsedBookRoute = parseBookRouteSegment(bookSlugParam);

  if (!parsedBookRoute.bookId) {
    await redirectLegacyChapterRoute(parsedBookRoute.bookSlug, chapterSlug, requestContext);
  }

  const baseData = await fetchChapterPageBaseData(
    parsedBookRoute.bookId!,
    chapterSlug,
    requestContext
  );
  const { book, chapter, chapters } = baseData;

  if (!book || !chapter || book.slug !== parsedBookRoute.bookSlug) {
    notFound();
  }

  return {
    book,
    chapter,
    chapters,
    initialComments: null,
    initialBookmark: undefined,
    isAuthenticated: requestContext.sessionToken != null,
    isDraftMode: requestContext.isDraftMode,
    readingProgress: [],
  };
}

async function getPageRequestContext(): Promise<PageRequestContext> {
  const [sessionToken, preview] = await Promise.all([
    getAuthTokenFromAppRequest(),
    draftMode(),
  ]);
  const isDraftMode = preview.isEnabled;

  return {
    sessionToken,
    isDraftMode,
    payloadCache: isDraftMode
      ? undefined
      : sessionToken
        ? AUTH_PAYLOAD_CACHE
        : ONE_HOUR_PAYLOAD_CACHE,
  };
}

async function getChapterPageRequestContext(): Promise<ChapterPageRequestContext> {
  const [sessionToken, preview] = await Promise.all([
    getAuthTokenFromAppRequest(),
    draftMode(),
  ]);
  const isDraftMode = preview.isEnabled;
  const chapterPasswordProof =
    !isDraftMode && !sessionToken ? await getChapterProofFromAppRequest() : null;

  return {
    sessionToken,
    isDraftMode,
    chapterPasswordProof,
    payloadCache: isDraftMode
      ? undefined
      : sessionToken || chapterPasswordProof
        ? AUTH_PAYLOAD_CACHE
        : ONE_HOUR_PAYLOAD_CACHE,
  };
}

async function fetchChapterPageBaseData(
  bookId: number,
  chapterSlug: string,
  requestContext: ChapterPageRequestContext
) {
  return fetchChapterPageBasePayload(
    bookId,
    chapterSlug,
    toPayloadChapterOptions(requestContext)
  );
}

async function redirectLegacyBookSlug(
  bookSlug: string,
  requestContext: PageRequestContext
): Promise<never> {
  const accessibleResult = await getBookBySlug(bookSlug, {
    authToken: requestContext.sessionToken,
    cache: requestContext.payloadCache,
    draftMode: requestContext.isDraftMode,
  });

  if (!accessibleResult.book) {
    notFound();
  }

  redirect(buildBookHref(accessibleResult.book.id, accessibleResult.book.slug));
}

async function redirectLegacyChapterRoute(
  bookSlug: string,
  chapterSlug: string,
  requestContext: ChapterPageRequestContext
): Promise<never> {
  const accessibleResult = await getBookBySlug(bookSlug, {
    authToken: requestContext.sessionToken,
    cache: requestContext.payloadCache,
    draftMode: requestContext.isDraftMode,
  });

  if (!accessibleResult.book) {
    notFound();
  }

  const chapterData = await getChapterByBookAndSlug(accessibleResult.book.id, chapterSlug, {
    authToken: requestContext.sessionToken,
    cache: requestContext.payloadCache,
    chapterPasswordProof: requestContext.chapterPasswordProof,
    draftMode: requestContext.isDraftMode,
  });

  if (!chapterData.chapter) {
    notFound();
  }

  redirect(
    buildChapterHref(
      accessibleResult.book.id,
      accessibleResult.book.slug,
      chapterData.chapter.slug
    )
  );
}

function toPayloadOptions(requestContext: PageRequestContext): PayloadBookPageRequestOptions {
  return {
    authToken: requestContext.sessionToken,
    cache: requestContext.payloadCache,
    draftMode: requestContext.isDraftMode,
  };
}

function toPayloadChapterOptions(
  requestContext: ChapterPageRequestContext
): PayloadChapterPageRequestOptions {
  return {
    authToken: requestContext.sessionToken,
    cache: requestContext.payloadCache,
    draftMode: requestContext.isDraftMode,
    chapterPasswordProof: requestContext.chapterPasswordProof,
  };
}
