import type {
  HomePageData,
  Post,
  Category,
  Author,
  Homepage,
} from '../../types/cms';
import { fetchAPI, type FetchApiOptions } from './base';
import { createPostsWhere } from './posts';

const DEFAULT_HOME_POST_LIMIT = 5;
const AUTHOR_ID = 1; // quanghuy1242

export interface GetDataForHomeOptions {
  limit?: number;
  categoryId?: string | null;
  tags?: string[] | null;
  cache?: FetchApiOptions['cache'];
}

export interface GetDataForHomeResult {
  data: HomePageData;
  hasMore: boolean;
}

interface NormalizedHomeOptions {
  limit: number;
  categoryId: string | null;
  tags: string[] | null;
  cache?: FetchApiOptions['cache'];
}

interface HomePageResponse {
  Posts: {
    docs: Post[];
    hasNextPage: boolean;
  };
  Categories: {
    docs: Category[];
  };
  Homepage: Homepage | null;
  User: Author | null;
}

async function fetchHomeData({
  limit,
  categoryId,
  tags,
  cache,
}: NormalizedHomeOptions): Promise<GetDataForHomeResult> {
  const where = createPostsWhere(categoryId, tags);
  const queryLimit = limit + 1;

  const data = await fetchAPI<HomePageResponse>(
    `#graphql
      query HomePage($limit: Int!, $where: Post_where, $authorId: Int!) {
        Posts(limit: $limit, where: $where, sort: "-createdAt") {
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
              optimizedUrl
              thumbnailURL
              lowResUrl
              alt
              width
              height
            }
            author {
              id
              fullName
              avatar {
                url
                optimizedUrl
                thumbnailURL
                lowResUrl
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
        }

        Categories(limit: 5, sort: "-updatedAt") {
          docs {
            id
            name
            description
            slug
            image {
              id
              url
              optimizedUrl
              thumbnailURL
              lowResUrl
              alt
              width
              height
            }
          }
        }
        
        Homepage {
          header
          subHeader
          imageBanner {
            url
            optimizedUrl
            lowResUrl
            alt
          }
          meta {
            title
            description
            image {
              url
              optimizedUrl
              lowResUrl
              alt
            }
          }
        }
        
        User(id: $authorId) {
          id
          fullName
          avatar {
            url
            optimizedUrl
            thumbnailURL
            lowResUrl
            alt
            width
            height
          }
          bio
        }
      }
    `,
    {
      variables: {
        limit: Math.max(queryLimit, 1),
        where,
        authorId: AUTHOR_ID,
      },
      cache,
    }
  );

  const posts = data?.Posts?.docs ?? [];
  const hasMore =
    limit > 0 ? data?.Posts?.hasNextPage ?? false : posts.length > 0;
  const trimmedPosts = limit > 0 ? posts.slice(0, limit) : [];

  return {
    data: {
      allPosts: trimmedPosts,
      allCategories: data?.Categories?.docs ?? [],
      homepage: data?.Homepage ?? null,
      author: data?.User ?? null,
    },
    hasMore,
  };
}

function normalizeHomeOptions(
  options: GetDataForHomeOptions = {}
): NormalizedHomeOptions {
  const limit = Number.isFinite(options.limit)
    ? Math.max(0, options.limit ?? DEFAULT_HOME_POST_LIMIT)
    : DEFAULT_HOME_POST_LIMIT;
  const categoryId = options.categoryId ?? null;
  const tags =
    options.tags && options.tags.length ? [...options.tags].sort() : null;

  return {
    limit,
    categoryId,
    tags,
    cache: options.cache,
  };
}

export async function getDataForHome(
  options: GetDataForHomeOptions = {}
): Promise<GetDataForHomeResult> {
  const normalizedOptions = normalizeHomeOptions(options);
  return fetchHomeData(normalizedOptions);
}
