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
          url
          thumbnailURL
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

/**
 * @deprecated External content fetching is no longer used. Bio is stored in PayloadCMS.
 */
interface ContentResponse {
  content: string;
  errors?: unknown;
}

/**
 * @deprecated External content fetching is no longer used. Bio is stored in PayloadCMS.
 */
export async function getDataContentForAbout(url: string): Promise<string> {
  const res = await fetch(url, {
    method: 'GET',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch content. Status: ${res.status}`);
  }

  const json = (await res.json()) as ContentResponse;
  if (json.errors) {
    console.error(json.errors);
    throw new Error('Failed to fetch API');
  }
  return Buffer.from(json.content, 'base64').toString();
}
