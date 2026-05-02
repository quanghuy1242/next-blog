import type { BookmarksResult } from 'types/cms';
import { fetchAPIWithAuthToken } from './base';

const BOOKMARKS_QUERY = `#graphql
  query Bookmarks($contentType: String, $contentId: ID, $limit: Int, $page: Int) {
    bookmarks(contentType: $contentType, contentId: $contentId, limit: $limit, page: $page) {
      docs {
        id
        contentType
        chapter {
          ... on Chapter {
            id
            title
            slug
            book {
              ... on Book {
                id
                title
                slug
              }
            }
          }
        }
        book {
          ... on Book {
            id
            title
            slug
          }
        }
      }
      totalDocs
    }
  }
`;

const CREATE_BOOKMARK_MUTATION = `#graphql
  mutation CreateBookmark($contentType: String!, $chapterId: ID, $bookId: ID) {
    createBookmark(contentType: $contentType, chapterId: $chapterId, bookId: $bookId) {
      created
      bookmark {
        id
        contentType
        chapter {
          ... on Chapter { id title slug }
        }
        book {
          ... on Book { id title slug }
        }
      }
    }
  }
`;

const DELETE_BOOKMARK_MUTATION = `#graphql
  mutation DeleteBookmark($id: ID!) {
    deleteBookmark(id: $id) {
      ok
    }
  }
`;

interface BookmarksResponse {
  bookmarks: BookmarksResult | null;
}

interface CreateBookmarkResponse {
  createBookmark: {
    created: boolean;
    bookmark: {
      id: number;
      contentType: string;
      chapter: { id: number; title: string; slug: string } | null;
      book: { id: number; title: string; slug: string } | null;
    } | null;
  } | null;
}

interface DeleteBookmarkResponse {
  deleteBookmark: { ok: boolean } | null;
}

export async function getBookmarks(options?: {
  authToken?: string | null;
  contentType?: string;
  contentId?: string;
  limit?: number;
  page?: number;
}): Promise<BookmarksResult> {
  if (!options?.authToken) {
    return { docs: [], totalDocs: 0 };
  }

  const data = await fetchAPIWithAuthToken<BookmarksResponse>(
    BOOKMARKS_QUERY,
    {
      variables: {
        contentType: options.contentType,
        contentId: options.contentId,
        limit: options.limit,
        page: options.page,
      },
      authToken: options.authToken,
    }
  );

  return data?.bookmarks ?? { docs: [], totalDocs: 0 };
}

export async function createBookmark(
  input: { contentType: string; chapterId?: string; bookId?: string },
  options: { authToken: string }
): Promise<{ created: boolean; bookmarkId?: number }> {
  const data = await fetchAPIWithAuthToken<CreateBookmarkResponse>(
    CREATE_BOOKMARK_MUTATION,
    {
      variables: {
        contentType: input.contentType,
        chapterId: input.chapterId,
        bookId: input.bookId,
      },
      authToken: options.authToken,
    }
  );

  return {
    created: data?.createBookmark?.created ?? false,
    bookmarkId: data?.createBookmark?.bookmark?.id,
  };
}

export async function deleteBookmark(
  bookmarkId: string | number,
  options: { authToken: string }
): Promise<{ ok: boolean }> {
  const data = await fetchAPIWithAuthToken<DeleteBookmarkResponse>(
    DELETE_BOOKMARK_MUTATION,
    {
      variables: { id: bookmarkId },
      authToken: options.authToken,
    }
  );

  return { ok: data?.deleteBookmark?.ok ?? false };
}
