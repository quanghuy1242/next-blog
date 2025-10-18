import type { HomePageData } from '../../types/datocms';
import { fetchAPI, responsiveImageFragment } from './base';

export async function getDataForHome(): Promise<HomePageData> {
  const data = await fetchAPI<HomePageData>(
    `#graphql
      {
        allPosts(orderBy: date_DESC, first: 20) {
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
    `
  );
  return data;
}
