import type { AboutPageData, Author } from '@/types/cms';
import { fetchAPI } from './base';

const AUTHOR_ID = 1; // quanghuy1242

interface AboutPageResponse {
  User: Author | null;
}

export async function getDataForAbout(): Promise<AboutPageData> {
  const data = await fetchAPI<AboutPageResponse>(
    `#graphql
    query AboutPage($authorId: Int!) {
      User(id: $authorId) {
        id
        fullName
        avatar {
          id
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
        authorId: AUTHOR_ID,
      },
    }
  );

  return {
    author: data?.User ?? null,
  };
}
