import type { PostSlugData } from '../../types/datocms';
import { fetchAPI, responsiveImageFragment } from './base';

export async function getDataForPostSlug(
  slug: string,
  preview?: boolean
): Promise<PostSlugData> {
  const data = await fetchAPI<PostSlugData>(
    `#graphql
    query PostBySlug($slug: String) {
      post(filter: {slug: {eq: $slug}}) {
        title
        slug
        content
        date
        ogImage: coverImage{
          url(imgixParams: {fm: jpg, fit: crop, w: 1000, h: 500 })
        }
        coverImage {
          responsiveImage(imgixParams: {fm: jpg, fit: crop, w: 2000, h: 1000 }) {
            ...responsiveImageFragment
          }
        }
        author {
          name
          picture {
            url(imgixParams: {fm: jpg, fit: crop, w: 100, h: 100})
          }
        }
        metadata: _seoMetaTags {
          attributes
          content
          tag
        }
        category {
          name
        }
        tags
      }

      morePosts: allPosts(orderBy: date_DESC, first: 2, filter: {slug: {neq: $slug}}) {
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
        }
        tags
      }

      homepage {
        header
      }
    }

    ${responsiveImageFragment}
    `,
    {
      preview,
      variables: {
        slug,
      },
    }
  );
  return data;
}
