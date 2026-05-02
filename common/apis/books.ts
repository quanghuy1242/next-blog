import type {
  Book,
  BookSlugData,
  BooksPageData,
  Chapter,
  Homepage,
  PaginatedResponse,
} from 'types/cms';
import { fetchAPI, fetchAPIWithAuthToken } from './base';
import {
  buildBookCacheTags,
  buildBookDetailCacheTags,
  buildBooksListCacheTags,
  buildBookSlugCacheTags,
  normalizeCacheTags,
} from './cache';
import type { PayloadCacheSettings } from './cache';
import {
  getChapterProgressMetadataByBookIds,
  getChaptersByBookId,
  sortChapters,
} from './chapters';
import { getReadingProgress } from './reading-progress';
import { calculateWholeBookProgress } from 'common/utils/reading-progress';

const AUTHOR_ID = 1; // quanghuy1242
const DEFAULT_BOOKS_LIMIT = 6;

interface BooksResponse {
  Books: PaginatedResponse<Book>;
}

interface BooksPageResponse {
  Books: PaginatedResponse<Book>;
  Homepage: Pick<Homepage, 'header'> | null;
}

interface BookBySlugResponse {
  Books: {
    docs: Book[];
  };
  Homepage: Pick<Homepage, 'header'> | null;
}

interface BookDetailByIdResponse {
  Books: {
    docs: Book[];
  };
  Chapters: {
    docs: Chapter[];
  };
  Homepage: Pick<Homepage, 'header'> | null;
}

interface BookFetchOptions {
  authToken?: string | null;
  cache?: PayloadCacheSettings;
  draftMode?: boolean;
}

const BOOK_LOOKUP_FIELDS = `
  id
  slug
`;

const BOOK_LIST_FIELDS = `
  id
  title
  author
  slug
  totalWordCount
  cover {
    url
    optimizedUrl
  }
`;

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

export interface PaginatedBooksParams {
  limit: number;
  skip: number;
}

export interface PaginatedBooksResult {
  books: Book[];
  hasMore: boolean;
}

async function attachWholeBookProgress(
  books: Book[],
  options: BookFetchOptions
): Promise<Book[]> {
  if (!options.authToken || books.length === 0) {
    return books;
  }

  const bookIds = books.map((book) => book.id);

  const [chaptersByBookId, progressEntries] = await Promise.all([
    getChapterProgressMetadataByBookIds(bookIds, {
      authToken: options.authToken,
      cache: options.cache,
      draftMode: options.draftMode,
    }),
    Promise.all(
      bookIds.map(async (bookId) => [
        bookId,
        await getReadingProgress(String(bookId), {
          authToken: options.authToken,
          cache: options.cache,
        }),
      ] as const)
    ),
  ]);

  const readingProgressByBookId = new Map(progressEntries);

  return books.map((book) => ({
    ...book,
    readingProgressPct: calculateWholeBookProgress({
      chapters: chaptersByBookId[book.id] ?? [],
      records: readingProgressByBookId.get(book.id) ?? [],
      totalWordCount: book.totalWordCount,
    }),
  }));
}

const BOOK_STATUS_PUBLISHED = '{ _status: { equals: published } }';

function buildBookStatusFilter(draftMode?: boolean): string {
  if (draftMode) {
    return '{ _status: { in: [published, draft] } }';
  }
  return BOOK_STATUS_PUBLISHED;
}

function selectBookFetcher(options: BookFetchOptions) {
  if (options.draftMode) {
    return fetchAPI as typeof fetchAPIWithAuthToken;
  }
  return fetchAPIWithAuthToken;
}

export function createBooksWhere(): Record<string, unknown> {
  return {
    AND: [
      {
        _status: {
          equals: 'published',
        },
      },
      {
        createdBy: {
          equals: AUTHOR_ID,
        },
      },
    ],
  };
}

export async function getPaginatedBooks(
  { limit, skip }: PaginatedBooksParams,
  options: BookFetchOptions = {}
): Promise<PaginatedBooksResult> {
  const safeLimit = Math.max(1, limit);
  const page = Math.floor(skip / safeLimit) + 1;
  const fetcher = selectBookFetcher(options);

  const data = await fetcher<BooksResponse>(
    `#graphql
      query PaginatedBooks($limit: Int!, $page: Int!, $where: Book_where) {
        Books(limit: $limit, page: $page, where: $where, sort: "-updatedAt") {
          docs {
            ${BOOK_LIST_FIELDS}
          }
          hasNextPage
          hasPrevPage
          totalDocs
          totalPages
          page
          limit
        }
      }
    `,
    {
      variables: {
        limit: safeLimit,
        page,
        where: createBooksWhere(),
      },
      getCacheTags: buildBooksListCacheTags,
      authToken: options.authToken,
      cache: options.cache,
    }
  );

  const books = await attachWholeBookProgress(data?.Books?.docs ?? [], options);

  return {
    books,
    hasMore: data?.Books?.hasNextPage ?? false,
  };
}

export async function getDataForBooksPage(
  limit = DEFAULT_BOOKS_LIMIT,
  options: BookFetchOptions = {}
): Promise<BooksPageData> {
  const safeLimit = Math.max(1, limit);

  const data = await fetchAPIWithAuthToken<BooksPageResponse>(
    `#graphql
      query BooksPage($limit: Int!, $where: Book_where) {
        Books(limit: $limit, page: 1, where: $where, sort: "-updatedAt") {
          docs {
            ${BOOK_LIST_FIELDS}
          }
          hasNextPage
          hasPrevPage
          totalDocs
          totalPages
          page
          limit
        }

        Homepage {
          header
        }
      }
    `,
    {
      variables: {
        limit: safeLimit,
        where: createBooksWhere(),
      },
      getCacheTags: buildBooksListCacheTags,
      authToken: options.authToken,
      cache: options.cache,
    }
  );

  const books = await attachWholeBookProgress(data?.Books?.docs ?? [], options);

  return {
    books,
    hasMore: data?.Books?.hasNextPage ?? false,
    homepage: data?.Homepage ?? null,
  };
}

export async function getBookBySlug(
  slug: string,
  options: BookFetchOptions = {}
): Promise<{ book: Book | null; homepage: Pick<Homepage, 'header'> | null }> {
  const trimmedSlug = slug.trim();

  if (!trimmedSlug) {
    return {
      book: null,
      homepage: null,
    };
  }

  const fetcher = selectBookFetcher(options);
  const statusFilter = buildBookStatusFilter(options.draftMode);

  const data = await fetcher<BookBySlugResponse>(
    `#graphql
      query BookBySlug($slug: String!) {
        Books(
          where: {
            AND: [
              { slug: { equals: $slug } }
              ${statusFilter}
            ]
          }
          limit: 1
        ) {
          docs {
            ${BOOK_LOOKUP_FIELDS}
          }
        }

        Homepage {
          header
        }
      }
    `,
    {
      variables: {
        slug: trimmedSlug,
      },
      getCacheTags: (data) => {
        const book = data?.Books?.docs?.[0] ?? null;

        return normalizeCacheTags([
          ...buildBookSlugCacheTags(trimmedSlug),
          ...buildBookCacheTags(book?.id),
        ]);
      },
      authToken: options.authToken,
      cache: options.cache,
    }
  );

  return {
    book: data?.Books?.docs?.[0] ?? null,
    homepage: data?.Homepage ?? null,
  };
}

export async function getBookDetailBySlug(
  slug: string,
  options: BookFetchOptions = {}
): Promise<BookSlugData> {
  const { book, homepage } = await getBookBySlug(slug, options);

  if (!book) {
    return {
      book: null,
      chapters: [],
      homepage,
    };
  }

  const chapters = await getChaptersByBookId(book.id, options);

  return {
    book,
    chapters,
    homepage,
  };
}

export async function getBookDetailById(
  bookId: number,
  options: BookFetchOptions = {}
): Promise<BookSlugData> {
  if (!Number.isInteger(bookId) || bookId <= 0) {
    return {
      book: null,
      chapters: [],
      homepage: null,
    };
  }

  const fetcher = selectBookFetcher(options);
  const bookStatusFilter = buildBookStatusFilter(options.draftMode);
  const chapterStatusFilter = options.draftMode
    ? '{ _status: { in: [published, draft] } }'
    : '{ _status: { equals: published } }';

  const data = await fetcher<BookDetailByIdResponse>(
    `#graphql
      query BookDetailWithChaptersByBookId($bookId: Int!, $bookRelationId: JSON!) {
        Books(
          where: {
            AND: [
              { id: { equals: $bookId } }
              ${bookStatusFilter}
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
              ${chapterStatusFilter}
            ]
          }
          sort: "order"
          limit: 200
        ) {
          docs {
            id
            title
            slug
            order
            hasPassword
            chapterWordCount
          }
        }

        Homepage {
          header
        }
      }
    `,
    {
      variables: {
        bookId,
        bookRelationId: bookId,
      },
      getCacheTags: () => buildBookDetailCacheTags(bookId),
      authToken: options.authToken,
      cache: options.cache,
    }
  );

  return {
    book: data?.Books?.docs?.[0] ?? null,
    chapters: sortChapters(data?.Chapters?.docs ?? []),
    homepage: data?.Homepage ?? null,
  };
}
