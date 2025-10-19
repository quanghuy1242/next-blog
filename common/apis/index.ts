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

export async function getDataForHome(
  options: GetDataForHomeOptions = {}
): Promise<GetDataForHomeResult> {
  const { limit = DEFAULT_HOME_POST_LIMIT, categoryId = null } = options;
  const rawTags = options.tags ?? null;
  const sanitizedLimit = Number.isFinite(limit) ? Math.max(0, limit) : 0;
  const filter = createPostsFilter(
    categoryId,
    Array.isArray(rawTags) && rawTags.length ? rawTags : null
  );

  const queryLimit = sanitizedLimit + 1;

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
    }
  );

  const posts = data?.allPosts ?? [];
  const hasMore =
    sanitizedLimit > 0 ? posts.length > sanitizedLimit : posts.length > 0;
  const trimmedPosts =
    sanitizedLimit > 0 ? posts.slice(0, sanitizedLimit) : [];

  return {
    data: {
      ...data,
      allPosts: trimmedPosts,
    },
    hasMore,
  };
}
