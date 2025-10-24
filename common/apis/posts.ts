import { fetchAPI } from './base';
import type { Post, PaginatedResponse } from 'types/cms';
import { uniqueSortedStrings } from '../utils/query';

interface PaginatedPostsResponse {
  Posts: PaginatedResponse<Post>;
}

export interface PaginatedPostsResult {
  posts: Post[];
  hasMore: boolean;
}

export interface PaginatedPostsParams {
  limit: number;
  skip: number;
  categoryId?: string | null;
  tags?: string[] | null;
}

const AUTHOR_ID = 1; // quanghuy1242

export async function getPaginatedPosts({
  limit,
  skip,
  categoryId,
  tags,
}: PaginatedPostsParams): Promise<PaginatedPostsResult> {
  // Convert skip to page number
  const page = Math.floor(skip / limit) + 1;

  const where = createPostsWhere(categoryId, tags);

  const data = await fetchAPI<PaginatedPostsResponse>(
    `#graphql
      query PaginatedPosts($limit: Int!, $page: Int!, $where: Post_where) {
        Posts(limit: $limit, page: $page, where: $where) {
          docs {
            id
            title
            slug
            excerpt
            createdAt
            updatedAt
            coverImage {
              id
              url
              thumbnailURL
              alt
              width
              height
            }
            author {
              id
              fullName
              avatar {
                url
                thumbnailURL
                alt
              }
            }
            category {
              id
              name
              slug
            }
            tags {
              tag
              id
            }
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
        limit,
        page,
        where,
      },
    }
  );

  const posts = data?.Posts?.docs ?? [];
  const hasMore = data?.Posts?.hasNextPage ?? false;

  return {
    posts,
    hasMore,
  };
}

export function createPostsWhere(
  categoryId: string | null | undefined,
  tags: string[] | null | undefined
): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = [];

  // Always filter for published posts by quanghuy1242
  conditions.push({
    _status: { equals: 'published' },
  });
  conditions.push({
    author: { equals: AUTHOR_ID },
  });

  if (categoryId) {
    conditions.push({ category: { equals: parseInt(categoryId, 10) } });
  }

  if (Array.isArray(tags) && tags.length) {
    const sanitizedTags = uniqueSortedStrings(tags);

    for (const tag of sanitizedTags) {
      const trimmed = tag.trim();

      if (trimmed) {
        conditions.push({
          tags__tag: {
            like: trimmed,
          },
        });
      }
    }
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return {
    AND: conditions,
  };
}

/**
 * Legacy function name for backwards compatibility
 * @deprecated Use createPostsWhere instead
 */
export function createPostsFilter(
  categoryId: string | null | undefined,
  tags: string[] | null | undefined
): Record<string, unknown> {
  return createPostsWhere(categoryId, tags);
}
