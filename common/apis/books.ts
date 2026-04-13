import type {
  Book,
  BooksPageData,
  Homepage,
  PaginatedResponse,
} from 'types/cms';
import { fetchAPI } from './base';

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

const BOOK_FIELDS = `
  id
  title
  author
  slug
  cover {
    id
    url
    optimizedUrl
    thumbnailURL
    lowResUrl
    alt
    width
    height
  }
  origin
  sourceType
  sourceId
  sourceHash
  sourceVersion
  syncStatus
  importBatchId
  importStatus
  importTotalChapters
  importCompletedChapters
  importStartedAt
  importFinishedAt
  importFailedAt
  lastImportedAt
  importErrorSummary
  updatedAt
  createdAt
  _status
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

export async function getPaginatedBooks({
  limit,
  skip,
}: PaginatedBooksParams): Promise<PaginatedBooksResult> {
  const safeLimit = Math.max(1, limit);
  const page = Math.floor(skip / safeLimit) + 1;

  const data = await fetchAPI<BooksResponse>(
    `#graphql
      query PaginatedBooks($limit: Int!, $page: Int!, $where: Book_where) {
        Books(limit: $limit, page: $page, where: $where, sort: "-updatedAt") {
          docs {
            ${BOOK_FIELDS}
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
    }
  );

  return {
    books: data?.Books?.docs ?? [],
    hasMore: data?.Books?.hasNextPage ?? false,
  };
}

export async function getDataForBooksPage(
  limit = DEFAULT_BOOKS_LIMIT
): Promise<BooksPageData> {
  const safeLimit = Math.max(1, limit);

  const data = await fetchAPI<BooksPageResponse>(
    `#graphql
      query BooksPage($limit: Int!, $where: Book_where) {
        Books(limit: $limit, page: 1, where: $where, sort: "-updatedAt") {
          docs {
            ${BOOK_FIELDS}
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
    }
  );

  return {
    books: data?.Books?.docs ?? [],
    hasMore: data?.Books?.hasNextPage ?? false,
    homepage: data?.Homepage ?? null,
  };
}

export async function getBookBySlug(
  slug: string
): Promise<{ book: Book | null; homepage: Pick<Homepage, 'header'> | null }> {
  const trimmedSlug = slug.trim();

  if (!trimmedSlug) {
    return {
      book: null,
      homepage: null,
    };
  }

  const data = await fetchAPI<BookBySlugResponse>(
    `#graphql
      query BookBySlug($slug: String!, $authorId: Int!) {
        Books(
          where: {
            AND: [
              { slug: { equals: $slug } }
              { _status: { equals: published } }
              { createdBy: { equals: $authorId } }
            ]
          }
          limit: 1
        ) {
          docs {
            ${BOOK_FIELDS}
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
        authorId: AUTHOR_ID,
      },
    }
  );

  return {
    book: data?.Books?.docs?.[0] ?? null,
    homepage: data?.Homepage ?? null,
  };
}
