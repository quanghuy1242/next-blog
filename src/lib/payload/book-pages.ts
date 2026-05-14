import type { PayloadCacheSettings } from './cache';
import { fetchAPI, fetchAPIWithAuthToken } from './base';
import type {
  Book,
  BookmarkRecord,
  Chapter,
  CommentsResult,
  ReadingProgressRecord,
} from '@/types/cms';

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

export interface PayloadBookPageRequestOptions {
  authToken?: string | null;
  cache?: PayloadCacheSettings;
  draftMode?: boolean;
}

export interface PayloadChapterPageRequestOptions
  extends PayloadBookPageRequestOptions {
  chapterPasswordProof?: string | null;
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

export async function fetchAuthenticatedBookPagePayload(
  bookId: number,
  options: PayloadBookPageRequestOptions
) {
  const fetcher = selectPayloadFetcher(options);

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
              ${buildBookStatusFilter(options.draftMode)}
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
              ${buildChapterStatusFilter(options.draftMode)}
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
      authToken: options.authToken,
      cache: options.cache,
    }
  );

  return {
    book: data?.Books?.docs?.[0] ?? null,
    chapters: sortChaptersForPage(data?.Chapters?.docs ?? []),
    bookmark: data?.Bookmarks?.docs?.[0] ?? null,
    readingProgress: data?.readingProgress?.records ?? [],
  };
}

export async function fetchPublicBookPagePayload(
  bookId: number,
  options: PayloadBookPageRequestOptions
) {
  const fetcher = selectPayloadFetcher(options);

  const data = await fetcher<BookPageBaseResponse>(
    `#graphql
      query BookPagePublic($bookId: Int!, $bookRelationId: JSON!) {
        Books(
          where: {
            AND: [
              { id: { equals: $bookId } }
              ${buildBookStatusFilter(options.draftMode)}
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
              ${buildChapterStatusFilter(options.draftMode)}
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
      authToken: options.authToken,
      cache: options.cache,
    }
  );

  return {
    book: data?.Books?.docs?.[0] ?? null,
    chapters: sortChaptersForPage(data?.Chapters?.docs ?? []),
  };
}

export async function fetchChapterPageBasePayload(
  bookId: number,
  chapterSlug: string,
  options: PayloadChapterPageRequestOptions
) {
  const fetcher = selectPayloadFetcher(options);

  const data = await fetcher<ChapterPageBaseResponse>(
    `#graphql
      query ChapterPageBase($bookRelationId: JSON!, $chapterSlug: String!) {
        ChapterMatch: Chapters(
          where: {
            AND: [
              { book: { equals: $bookRelationId } }
              { slug: { equals: $chapterSlug } }
              ${buildChapterStatusFilter(options.draftMode)}
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
              ${buildChapterStatusFilter(options.draftMode)}
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
      authToken: options.authToken,
      cache: options.cache,
      requestHeaders: buildChapterProofHeaders(options.chapterPasswordProof),
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

export async function fetchAuthenticatedChapterPageSupplementalPayload(
  bookId: number,
  chapterId: number,
  options: PayloadChapterPageRequestOptions & {
    includeComments: boolean;
  }
) {
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
      authToken: options.authToken!,
      cache: options.cache,
      requestHeaders: buildChapterProofHeaders(options.chapterPasswordProof),
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

export async function fetchPublicChapterCommentsPayload(
  chapterId: number,
  options: PayloadChapterPageRequestOptions
) {
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
      requestHeaders: buildChapterProofHeaders(options.chapterPasswordProof),
      cache: options.cache,
    }
  );

  return data?.comments ?? emptyCommentsResult();
}

function selectPayloadFetcher(
  options: PayloadBookPageRequestOptions | PayloadChapterPageRequestOptions
) {
  if (options.draftMode) {
    return fetchAPI as typeof fetchAPIWithAuthToken;
  }

  return fetchAPIWithAuthToken;
}

function buildBookStatusFilter(draft?: boolean): string {
  if (draft) {
    return '{ _status: { in: [published, draft] } }';
  }

  return BOOK_STATUS_PUBLISHED;
}

function buildChapterStatusFilter(draft?: boolean): string {
  if (draft) {
    return '{ _status: { in: [published, draft] } }';
  }

  return CHAPTER_STATUS_PUBLISHED;
}

function buildChapterProofHeaders(chapterPasswordProof?: string | null) {
  if (!chapterPasswordProof) {
    return undefined;
  }

  return {
    'x-chapter-password-proof': chapterPasswordProof,
  };
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
