import type { AboutPageData } from '../../types/datocms';
import { fetchAPI } from './base';

export async function getDataForAbout(name: string): Promise<AboutPageData> {
  const data = await fetchAPI<AboutPageData>(
    `#graphql
    query AuthorByName($name: String) {
      author(filter: { name: { eq: $name }}) {
        name
        externalContentUrl
        metadata: _seoMetaTags {
          attributes
          content
          tag
        }
      }

      homepage {
        header
      }
    }
    `,
    {
      variables: {
        name,
      },
    }
  );
  return data;
}

interface ContentResponse {
  content: string;
  errors?: unknown;
}

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
