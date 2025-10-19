import { fetchAPI, responsiveImageFragment } from './base';
import type { Post } from 'types/datocms';

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
  tag?: string | null;
}

export async function getPaginatedPosts({
  limit,
  skip,
  categoryId,
  tag,
}: PaginatedPostsParams): Promise<PaginatedPostsResult> {
  const first = limit + 1;

  const filter: Record<string, unknown> | null = buildFilter(categoryId, tag);

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

function buildFilter(
  categoryId: string | null | undefined,
  tag: string | null | undefined
): Record<string, unknown> | null {
  const filters: Record<string, unknown> = {};

  if (categoryId) {
    filters.category = { eq: categoryId };
  }

  if (tag) {
    const pattern = createTagRegex(tag);

    if (pattern) {
      filters.tags = {
        matches: {
          pattern,
          caseSensitive: false,
        },
      };
    }
  }

  return Object.keys(filters).length ? filters : null;
}

function createTagRegex(tag: string): string | null {
  const trimmed = tag.trim();

  if (!trimmed) {
    return null;
  }

  const escaped = escapeRegex(trimmed);

  return `.*${escaped}.*`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
