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
import { fetchAPI, fetchAPIWithAuthToken } from '@/lib/payload/base';
import { getBookBySlug } from '@/lib/payload/books';
import { AUTH_PAYLOAD_CACHE, ONE_HOUR_PAYLOAD_CACHE, type PayloadCacheSettings } from '@/lib/payload/cache';
import { getChapterByBookAndSlug } from '@/lib/payload/chapters';
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

const BOOK_STATUS_PUBLISHED = '{ _status: { equals: published } }';
const CHAPTER_STATUS_PUBLISHED = '{ _status: { equals: published } }';

const BOOK_DETAIL_FIELDS = `
  id
  title
  author
  slug
  totalWordCount
  cover {
    url
    optimizedUrl
    lowResUrl
  }
`;

const CHAPTER_PAGE_FIELDS = `
  id
  title
  slug
  order
  hasPassword
  chapterWordCount
`;

const CHAPTER_READER_DETAIL_FIELDS = `
  id
  title
  slug
  hasPassword
  content
  book {
    ... on Book {
      id
      title
      slug
      origin
      sourceType
      cover {
        url
        optimizedUrl
      }
    }
  }
`;

const CHAPTER_READER_LIST_FIELDS = `
  ${CHAPTER_PAGE_FIELDS}
  chapterSourceKey
`;

const READING_PROGRESS_FIELDS = `
  chapterId
  progress
  completedAt
  updatedAt
`;

const BOOKMARK_RECORD_FIELDS = `
  id
  contentType
  chapter(draft: true) {
    ... on Chapter {
      id
      title
      slug
      book(draft: true) {
        ... on Book {
          id
          title
          slug
        }
      }
    }
  }
  book(draft: true) {
    ... on Book {
      id
      title
      slug
    }
  }
`;

const COMMENT_FIELDS = `
  id
  content
  status
  createdAt
  updatedAt
  parentCommentId
  chapterId
  postId
  isOwnPending
  isDeleted
  viewerCanEdit
  viewerCanDelete
  editWindowEndsAt
  author {
    id
    fullName
    avatar {
      id
      url
      thumbnailURL
      optimizedUrl
      lowResUrl
      alt
    }
  }
`;

interface PageRequestContext {
  sessionToken: string | null;
  isDraftMode: boolean;
  payloadCache?: PayloadCacheSettings;
}

interface ChapterPageRequestContext extends PageRequestContext {
  chapterPasswordProof: string | null;
}

interface BookPageBaseResponse {
  Books: {
    docs: Book[];
  };
  Chapters: {
    docs: Chapter[];
  };
}

interface BookPageAuthenticatedResponse extends BookPageBaseResponse {
  readingProgress: {
    records: ReadingProgressRecord[];
  } | null;
  Bookmarks: {
    docs: BookmarkRecord[];
  } | null;
}

interface ChapterPageBaseResponse {
  ChapterMatch: {
    docs: Chapter[];
  };
  ChaptersByBook: {
    docs: Chapter[];
  };
}

interface ChapterPageSupplementalResponse {
  readingProgress: {
    records: ReadingProgressRecord[];
  } | null;
  Bookmarks: {
    docs: BookmarkRecord[];
  } | null;
  comments: CommentsResult | null;
}

interface ChapterCommentsResponse {
  comments: CommentsResult | null;
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

  const { book, chapters, bookmark, readingProgress } =
    requestContext.sessionToken
      ? await fetchAuthenticatedBookPageData(parsedBookRoute.bookId!, requestContext)
      : await fetchPublicBookPageData(parsedBookRoute.bookId!, requestContext);

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

async function fetchAuthenticatedBookPageData(
  bookId: number,
  requestContext: PageRequestContext
) {
  const fetcher = selectPayloadFetcher(requestContext);
  const statusFilter = buildBookStatusFilter(requestContext.isDraftMode);

  const data = await fetcher<BookPageAuthenticatedResponse>(
    `#graphql
      query BookPageAuthenticated(
        $bookId: Int!
        $bookRelationId: JSON!
        $readingProgressBookId: ID!
        $bookmarkWhere: Bookmark_where
      ) {
        Books(
          where: {
            AND: [
              { id: { equals: $bookId } }
              ${statusFilter}
            ]
          }
          limit: 1
        ) {
          docs {
            ${BOOK_DETAIL_FIELDS}
          }
        }

        Chapters(
          where: {
            AND: [
              { book: { equals: $bookRelationId } }
              ${buildChapterStatusFilter(requestContext.isDraftMode)}
            ]
          }
          sort: "order"
          limit: 200
        ) {
          docs {
            ${CHAPTER_PAGE_FIELDS}
          }
        }

        readingProgress(bookId: $readingProgressBookId) {
          records {
            ${READING_PROGRESS_FIELDS}
          }
        }

        Bookmarks(where: $bookmarkWhere, limit: 1) {
          docs {
            ${BOOKMARK_RECORD_FIELDS}
          }
        }
      }
    `,
    {
      variables: {
        bookId,
        bookRelationId: bookId,
        readingProgressBookId: String(bookId),
        bookmarkWhere: {
          and: [
            { contentType: { equals: 'book' } },
            { book: { equals: String(bookId) } },
          ],
        },
      },
      authToken: requestContext.sessionToken,
      cache: requestContext.payloadCache,
    }
  );

  return {
    book: data?.Books?.docs?.[0] ?? null,
    chapters: sortChaptersForPage(data?.Chapters?.docs ?? []),
    bookmark: data?.Bookmarks?.docs?.[0] ?? null,
    readingProgress: data?.readingProgress?.records ?? [],
  };
}

async function fetchPublicBookPageData(
  bookId: number,
  requestContext: PageRequestContext
) {
  const fetcher = selectPayloadFetcher(requestContext);

  const data = await fetcher<BookPageBaseResponse>(
    `#graphql
      query BookPagePublic($bookId: Int!, $bookRelationId: JSON!) {
        Books(
          where: {
            AND: [
              { id: { equals: $bookId } }
              ${buildBookStatusFilter(requestContext.isDraftMode)}
            ]
          }
          limit: 1
        ) {
          docs {
            ${BOOK_DETAIL_FIELDS}
          }
        }

        Chapters(
          where: {
            AND: [
              { book: { equals: $bookRelationId } }
              ${buildChapterStatusFilter(requestContext.isDraftMode)}
            ]
          }
          sort: "order"
          limit: 200
        ) {
          docs {
            ${CHAPTER_PAGE_FIELDS}
          }
        }
      }
    `,
    {
      variables: {
        bookId,
        bookRelationId: bookId,
      },
      authToken: requestContext.sessionToken,
      cache: requestContext.payloadCache,
    }
  );

  return {
    book: data?.Books?.docs?.[0] ?? null,
    chapters: sortChaptersForPage(data?.Chapters?.docs ?? []),
    bookmark: null,
    readingProgress: [],
  };
}

async function fetchChapterPageBaseData(
  bookId: number,
  chapterSlug: string,
  requestContext: ChapterPageRequestContext
) {
  const fetcher = selectPayloadFetcher(requestContext);

  const data = await fetcher<ChapterPageBaseResponse>(
    `#graphql
      query ChapterPageBase($bookRelationId: JSON!, $chapterSlug: String!) {
        ChapterMatch: Chapters(
          where: {
            AND: [
              { book: { equals: $bookRelationId } }
              { slug: { equals: $chapterSlug } }
              ${buildChapterStatusFilter(requestContext.isDraftMode)}
            ]
          }
          limit: 1
        ) {
          docs {
            ${CHAPTER_READER_DETAIL_FIELDS}
          }
        }

        ChaptersByBook: Chapters(
          where: {
            AND: [
              { book: { equals: $bookRelationId } }
              ${buildChapterStatusFilter(requestContext.isDraftMode)}
            ]
          }
          sort: "order"
          limit: 200
        ) {
          docs {
            ${CHAPTER_READER_LIST_FIELDS}
          }
        }
      }
    `,
    {
      variables: {
        bookRelationId: bookId,
        chapterSlug: chapterSlug.trim(),
      },
      authToken: requestContext.sessionToken,
      cache: requestContext.payloadCache,
      requestHeaders: buildChapterProofHeaders(requestContext.chapterPasswordProof),
    }
  );

  const chapter = data?.ChapterMatch?.docs?.[0] ?? null;
  const book = chapter?.book && typeof chapter.book === 'object' ? (chapter.book as Book) : null;

  return {
    book,
    chapter,
    chapters: sortChaptersForPage(data?.ChaptersByBook?.docs ?? []),
  };
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
    const data = await fetchAPIWithAuthToken<ChapterPageSupplementalResponse>(
      `#graphql
        query ChapterPageSupplemental(
          $readingProgressBookId: ID!
          $bookmarkWhere: Bookmark_where
          $commentsChapterId: ID
        ) {
          readingProgress(bookId: $readingProgressBookId) {
            records {
              ${READING_PROGRESS_FIELDS}
            }
          }

          Bookmarks(where: $bookmarkWhere, limit: 1) {
            docs {
              ${BOOKMARK_RECORD_FIELDS}
            }
          }

          comments(chapterId: $commentsChapterId) {
            docs {
              ${COMMENT_FIELDS}
            }
            totalDocs
            viewerCanComment
          }
        }
      `,
      {
        variables: {
          readingProgressBookId: String(bookId),
          bookmarkWhere: {
            and: [
              { contentType: { equals: 'chapter' } },
              { chapter: { equals: String(chapterId) } },
            ],
          },
          commentsChapterId: options.includeComments ? String(chapterId) : undefined,
        },
        authToken: requestContext.sessionToken!,
        cache: requestContext.payloadCache,
        requestHeaders: buildChapterProofHeaders(requestContext.chapterPasswordProof),
      }
    );

    return {
      comments: options.includeComments
        ? (data?.comments ?? emptyCommentsResult())
        : null,
      bookmark: data?.Bookmarks?.docs?.[0] ?? null,
      readingProgress: data?.readingProgress?.records ?? [],
    };
  }

  if (!options.includeComments) {
    return {
      comments: null,
      bookmark: null,
      readingProgress: [],
    };
  }

  const data = await fetchAPIWithAuthToken<ChapterCommentsResponse>(
    `#graphql
      query ChapterPageComments($commentsChapterId: ID!) {
        comments(chapterId: $commentsChapterId) {
          docs {
            ${COMMENT_FIELDS}
          }
          totalDocs
          viewerCanComment
        }
      }
    `,
    {
      variables: {
        commentsChapterId: String(chapterId),
      },
      requestHeaders: buildChapterProofHeaders(requestContext.chapterPasswordProof),
      cache: requestContext.payloadCache,
    }
  );

  return {
    comments: data?.comments ?? emptyCommentsResult(),
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

function selectPayloadFetcher(
  requestContext: PageRequestContext | ChapterPageRequestContext
) {
  if (requestContext.isDraftMode) {
    return fetchAPI as typeof fetchAPIWithAuthToken;
  }

  return fetchAPIWithAuthToken;
}

function buildBookStatusFilter(draft: boolean): string {
  if (draft) {
    return '{ _status: { in: [published, draft] } }';
  }

  return BOOK_STATUS_PUBLISHED;
}

function buildChapterStatusFilter(draft: boolean): string {
  if (draft) {
    return '{ _status: { in: [published, draft] } }';
  }

  return CHAPTER_STATUS_PUBLISHED;
}

function buildChapterProofHeaders(chapterPasswordProof: string | null) {
  if (!chapterPasswordProof) {
    return undefined;
  }

  return {
    'x-chapter-password-proof': chapterPasswordProof,
  };
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

function sortChaptersForPage(chapters: Chapter[]): Chapter[] {
  return [...chapters].sort((first, second) => {
    if (first.order !== second.order) {
      return first.order - second.order;
    }

    return first.id - second.id;
  });
}

function emptyCommentsResult(): CommentsResult {
  return {
    docs: [],
    totalDocs: 0,
    viewerCanComment: false,
  };
}
