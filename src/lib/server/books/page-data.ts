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
import { getBookBySlug } from '@/lib/payload/books';
import { AUTH_PAYLOAD_CACHE, ONE_HOUR_PAYLOAD_CACHE, type PayloadCacheSettings } from '@/lib/payload/cache';
import { getChapterByBookAndSlug } from '@/lib/payload/chapters';
import {
  fetchAuthenticatedBookPagePayload,
  fetchAuthenticatedChapterPageSupplementalPayload,
  fetchChapterPageBasePayload,
  fetchPublicBookPagePayload,
  fetchPublicChapterCommentsPayload,
  type PayloadBookPageRequestOptions,
  type PayloadChapterPageRequestOptions,
} from '@/lib/payload/book-pages';
import { calculateWholeBookProgress } from '@/lib/reading/reading-progress';
import {
  buildBookHref,
  buildChapterHref,
  parseBookRouteSegment,
} from '@/lib/routes/book-route';
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
  initialBookmark: BookmarkRecord | null;
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
  initialBookmark: BookmarkRecord | null;
  isAuthenticated: boolean;
  isDraftMode: boolean;
  readingProgress: ReadingProgressRecord[];
}

export async function getBookPageData(slugParam: string): Promise<BookPageData> {
  const requestContext = await getPageRequestContext();
  const parsedBookRoute = parseBookRouteSegment(slugParam);

  if (!parsedBookRoute.bookId) {
    await redirectLegacyBookSlug(parsedBookRoute.bookSlug, requestContext);
  }

  const authenticatedPayload = requestContext.sessionToken
    ? await fetchAuthenticatedBookPagePayload(
        parsedBookRoute.bookId!,
        toPayloadOptions(requestContext)
      )
    : null;
  const publicPayload = authenticatedPayload
    ? null
    : await fetchPublicBookPagePayload(
        parsedBookRoute.bookId!,
        toPayloadOptions(requestContext)
      );
  const book = authenticatedPayload?.book ?? publicPayload?.book ?? null;
  const chapters = authenticatedPayload?.chapters ?? publicPayload?.chapters ?? [];
  const bookmark = authenticatedPayload?.bookmark ?? null;
  const readingProgress = authenticatedPayload?.readingProgress ?? [];

  if (!book || book.slug !== parsedBookRoute.bookSlug) {
    notFound();
  }

  const continueReadingChapterSlug = getContinueReadingChapterSlug(chapters, readingProgress);
  const readingProgressByChapterId = buildReadingProgressByChapterId(readingProgress);
  const wholeBookProgress = calculateWholeBookProgress({
    chapters,
    records: readingProgress,
    totalWordCount: book.totalWordCount,
  });

  return {
    book,
    chapters,
    continueReadingChapterSlug,
    initialBookmark: bookmark,
    isAuthenticated: requestContext.sessionToken != null,
    isDraftMode: requestContext.isDraftMode,
    readingProgress,
    readingProgressByChapterId,
    wholeBookProgress,
  };
}

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

  const isChapterLocked = chapter.hasPassword === true && chapter.content == null;
  const supplemental = await fetchChapterPageSupplementalData(
    book.id,
    chapter.id,
    requestContext,
    {
      includeComments: !isChapterLocked,
      includeViewerData: requestContext.sessionToken != null,
    }
  );

  return {
    book,
    chapter,
    chapters,
    initialComments: supplemental.comments,
    initialBookmark: supplemental.bookmark,
    isAuthenticated: requestContext.sessionToken != null,
    isDraftMode: requestContext.isDraftMode,
    readingProgress: supplemental.readingProgress,
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

async function fetchChapterPageSupplementalData(
  bookId: number,
  chapterId: number,
  requestContext: ChapterPageRequestContext,
  options: {
    includeComments: boolean;
    includeViewerData: boolean;
  }
) {
  if (options.includeViewerData) {
    return fetchAuthenticatedChapterPageSupplementalPayload(
      bookId,
      chapterId,
      {
        ...toPayloadChapterOptions(requestContext),
        includeComments: options.includeComments,
      }
    );
  }

  if (!options.includeComments) {
    return {
      comments: null,
      bookmark: null,
      readingProgress: [],
    };
  }

  return {
    comments: await fetchPublicChapterCommentsPayload(
      chapterId,
      toPayloadChapterOptions(requestContext)
    ),
    bookmark: null,
    readingProgress: [],
  };
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

function buildReadingProgressByChapterId(records: ReadingProgressRecord[]) {
  if (!records.length) {
    return undefined;
  }

  return Object.fromEntries(
    records
      .filter((record) => record.chapterId != null && record.progress != null)
      .map((record) => [Number(record.chapterId!), record.progress!])
  );
}

function getContinueReadingChapterSlug(
  chapters: Chapter[],
  readingProgress: ReadingProgressRecord[]
): string | null {
  if (!readingProgress.length || !chapters.length) {
    return null;
  }

  const chapterSlugs = new Map(chapters.map((chapter) => [chapter.id, chapter.slug]));
  const incompleteProgress = readingProgress
    .filter((record) => record.chapterId != null && record.progress != null && record.progress < 95)
    .sort((first, second) => (second.updatedAt ?? '').localeCompare(first.updatedAt ?? ''));

  for (const record of incompleteProgress) {
    const chapterId = Number(record.chapterId);
    const slug = chapterSlugs.get(chapterId);

    if (slug) {
      return slug;
    }
  }

  return null;
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
