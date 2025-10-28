import type { AboutPageData, Author, Homepage } from '../../types/cms';
import { fetchAPI } from './base';

const AUTHOR_ID = 1; // quanghuy1242

interface AboutPageResponse {
  User: Author | null;
  Homepage: Pick<Homepage, 'header'> | null;
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

      Homepage {
        header
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
    homepage: data?.Homepage ?? null,
  };
}
