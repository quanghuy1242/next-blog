import type {
  Book,
  BookSlugData,
  BooksPageData,
  Chapter,
  Homepage,
  PaginatedResponse,
} from 'types/cms';
import { fetchAPIWithAuthToken } from './base';
import type { PayloadCacheSettings } from './cache';
import { getChaptersByBookId, sortChapters } from './chapters';

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

  const data = await fetchAPIWithAuthToken<BooksResponse>(
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
      authToken: options.authToken,
      cache: options.cache,
    }
  );

  return {
    books: data?.Books?.docs ?? [],
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
      authToken: options.authToken,
      cache: options.cache,
    }
  );

  return {
    books: data?.Books?.docs ?? [],
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

  const data = await fetchAPIWithAuthToken<BookBySlugResponse>(
    `#graphql
      query BookBySlug($slug: String!) {
        Books(
          where: {
            AND: [
              { slug: { equals: $slug } }
              { _status: { equals: published } }
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

  const data = await fetchAPIWithAuthToken<BookDetailByIdResponse>(
    `#graphql
      query BookDetailWithChaptersByBookId($bookId: Int!, $bookRelationId: JSON!) {
        Books(
          where: {
            AND: [
              { id: { equals: $bookId } }
              { _status: { equals: published } }
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
              { _status: { equals: published } }
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
