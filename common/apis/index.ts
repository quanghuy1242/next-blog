import { unstable_cache } from 'next/cache';
import type {
  HomePageData,
  Post,
  Category,
  Author,
  Homepage,
} from '../../types/cms';
import { fetchAPI } from './base';
import { createPostsWhere } from './posts';

const DEFAULT_HOME_POST_LIMIT = 5;
const HOME_DATA_REVALIDATE_SECONDS = 60;
const AUTHOR_ID = 1; // quanghuy1242

export interface GetDataForHomeOptions {
  limit?: number;
  categoryId?: string | null;
  tags?: string[] | null;
}

export interface GetDataForHomeResult {
  data: HomePageData;
  hasMore: boolean;
}

interface NormalizedHomeOptions {
  limit: number;
  categoryId: string | null;
  tags: string[] | null;
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
        
        Categories(limit: 2, sort: "-updatedAt") {
          docs {
            id
            name
            description
            slug
            image {
              id
              url
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
            lowResUrl
            alt
          }
          meta {
            title
            description
            image {
              url
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
      next: { revalidate: HOME_DATA_REVALIDATE_SECONDS },
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
  };
}

const cachedGetDataForHome = unstable_cache(
  async (options: NormalizedHomeOptions) => fetchHomeData(options),
  ['getDataForHome'],
  { revalidate: HOME_DATA_REVALIDATE_SECONDS }
);

export async function getDataForHome(
  options: GetDataForHomeOptions = {}
): Promise<GetDataForHomeResult> {
  const normalizedOptions = normalizeHomeOptions(options);

  return cachedGetDataForHome(normalizedOptions);
}
