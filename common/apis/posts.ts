import { fetchAPI, responsiveImageFragment } from './base';
import type { Post } from 'types/datocms';
import { uniqueSortedStrings } from '../utils/query';

interface PaginatedPostsResponse {
  allPosts: Post[];
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

export async function getPaginatedPosts({
  limit,
  skip,
  categoryId,
  tags,
}: PaginatedPostsParams): Promise<PaginatedPostsResult> {
  const first = limit + 1;

  const filter: Record<string, unknown> | null = createPostsFilter(
    categoryId,
    tags
  );

  const data = await fetchAPI<PaginatedPostsResponse>(
    `#graphql
      query PaginatedPosts($first: IntType!, $skip: IntType!, $filter: PostModelFilter) {
        allPosts(orderBy: date_DESC, first: $first, skip: $skip, filter: $filter) {
          title
          slug
          excerpt
          date
          coverImage {
            responsiveImage(imgixParams: { fm: jpg, fit: crop, w: 2000, h: 1000 }) {
              ...responsiveImageFragment
            }
          }
          author {
            displayName
            picture {
              url(imgixParams: { fm: jpg, fit: crop, w: 100, h: 100 })
            }
          }
          category {
            name
            slug
          }
          tags
        }
      }
      ${responsiveImageFragment}
    `,
    {
      variables: {
        first,
        skip,
        filter,
      },
    }
  );

  const posts = data?.allPosts ?? [];

  const hasMore = posts.length > limit;

  return {
    posts: posts.slice(0, Math.max(limit, 0)),
    hasMore,
  };
}

export function createPostsFilter(
  categoryId: string | null | undefined,
  tags: string[] | null | undefined
): Record<string, unknown> | null {
  const conditions: Record<string, unknown>[] = [];

  if (categoryId) {
    conditions.push({ category: { eq: categoryId } });
  }

  if (Array.isArray(tags) && tags.length) {
    const sanitizedTags = uniqueSortedStrings(tags);

    for (const tag of sanitizedTags) {
      const pattern = createTagRegex(tag);

      if (pattern) {
        conditions.push({
          tags: {
            matches: {
              pattern,
              caseSensitive: false,
            },
          },
        });
      }
    }
  }

  if (!conditions.length) {
    return null;
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return {
    AND: conditions,
  };
}

function createTagRegex(tag: string): string | null {
  const trimmed = tag.trim();

  if (!trimmed) {
    return null;
  }

  const escaped = escapeRegex(trimmed);

  return `(^|,\\s*)${escaped}(\\s*,|$)`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
