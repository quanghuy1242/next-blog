import type { BookmarksResult } from '@/types/cms';
import { fetchAPIWithAuthToken } from '../core/client';

const BOOKMARKS_QUERY = `#graphql
  query Bookmarks($where: Bookmark_where, $limit: Int, $page: Int) {
    Bookmarks(where: $where, limit: $limit, page: $page, sort: "-createdAt") {
      docs {
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
                author
                cover {
                  id
                  url
                  optimizedUrl
                  lowResUrl
                  alt
                  width
                  height
                }
                origin
                sourceType
                syncStatus
                importStatus
              }
            }
          }
        }
        book(draft: true) {
          ... on Book {
            id
            title
            slug
            author
            cover {
              id
              url
              optimizedUrl
              lowResUrl
              alt
              width
              height
            }
            origin
            sourceType
            syncStatus
            importStatus
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
  Bookmarks: BookmarksResult | null;
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
        where: buildBookmarksWhere(options.contentType, options.contentId),
        limit: options.limit,
        page: options.page,
      },
      authToken: options.authToken,
    }
  );

  return data?.Bookmarks ?? { docs: [], totalDocs: 0 };
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

function buildBookmarksWhere(contentType?: string, contentId?: string) {
  if (!contentType || !contentId) {
    return undefined;
  }

  if (contentType === 'chapter') {
    return {
      AND: [
        { contentType: { equals: 'chapter' } },
        { chapter: { equals: contentId } },
      ],
    };
  }

  if (contentType === 'book') {
    return {
      AND: [
        { contentType: { equals: 'book' } },
        { book: { equals: contentId } },
      ],
    };
  }

  return undefined;
}
