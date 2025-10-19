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
  category?: string | null;
  tag?: string | null;
}

export async function getPaginatedPosts({
  limit,
  skip,
  category,
  tag,
}: PaginatedPostsParams): Promise<PaginatedPostsResult> {
  const first = limit + 1;

  const filterConditions: string[] = [];

  if (category) {
    filterConditions.push('category: { slug: { eq: $category } }');
  }

  if (tag) {
    filterConditions.push('tags: { matches: { pattern: $tag } }');
  }

  const filterClause = filterConditions.length
    ? `, filter: { ${filterConditions.join(' ')} }`
    : '';

  const data = await fetchAPI<PaginatedPostsResponse>(
    `#graphql
      query PaginatedPosts($first: IntType!, $skip: IntType!, $category: String, $tag: String) {
        allPosts(orderBy: date_DESC, first: $first, skip: $skip${filterClause}) {
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
        category,
        tag,
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
