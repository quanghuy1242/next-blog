import { unstable_cache } from 'next/cache';
import type { HomePageData } from '../../types/datocms';
import { fetchAPI, responsiveImageFragment } from './base';
import { createPostsFilter } from './posts';

const DEFAULT_HOME_POST_LIMIT = 5;

export interface GetDataForHomeOptions {
  limit?: number;
  categoryId?: string | null;
  tags?: string[] | null;
}

export interface GetDataForHomeResult {
  data: HomePageData;
  hasMore: boolean;
}

const HOME_DATA_REVALIDATE_SECONDS = 60;

interface NormalizedHomeOptions {
  limit: number;
  categoryId: string | null;
  tags: string[] | null;
}

async function fetchHomeData({
  limit,
  categoryId,
  tags,
}: NormalizedHomeOptions): Promise<GetDataForHomeResult> {
  const filter = createPostsFilter(categoryId, tags);
  const queryLimit = limit + 1;

  const data = await fetchAPI<HomePageData>(
    `#graphql
      query HomePage($first: IntType!, $filter: PostModelFilter) {
        allPosts(orderBy: date_DESC, first: $first, filter: $filter) {
          title
          slug
          excerpt
          date
          coverImage {
            responsiveImage(imgixParams: {fm: jpg, fit: crop, w: 2000, h: 1000 }) {
              ...responsiveImageFragment
            }
          }
          author {
            displayName
            picture {
              url(imgixParams: {fm: jpg, fit: crop, w: 100, h: 100})
            }
          }
          category {
            name
            slug
          }
          tags
        }
        homepage {
          header
          subHeader
          metadata: _seoMetaTags {
            attributes
            content
            tag
          }
        }
        allCategories(orderBy: updatedAt_DESC, first: 2) {
          name
          description
          image {
            responsiveImage(imgixParams: {fm: jpg, fit: crop, w: 2000, h: 1000 }) {
              ...responsiveImageFragment
            }
          }
          slug
        }
        author(filter: { name: { eq: "quanghuy1242" } }) {
          name
          displayName
          description
          picture {
            responsiveImage(imgixParams: {fm: jpg, fit: crop, w: 600, h: 600 }) {
              ...responsiveImageFragment
            }
          }
        }
      }
  
      ${responsiveImageFragment}
    `,
    {
      variables: {
        first: Math.max(queryLimit, 1),
        filter,
      },
      next: { revalidate: HOME_DATA_REVALIDATE_SECONDS },
    }
  );

  const posts = data?.allPosts ?? [];
  const hasMore = limit > 0 ? posts.length > limit : posts.length > 0;
  const trimmedPosts = limit > 0 ? posts.slice(0, limit) : [];

  return {
    data: {
      ...data,
      allPosts: trimmedPosts,
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
