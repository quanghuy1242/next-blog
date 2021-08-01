import 'isomorphic-unfetch';
import { fetchAPI } from './base';

export async function getDataForAbout(name) {
  const data = await fetchAPI(
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

export async function getDataContentForAbout(url) {
  const res = await fetch(url, {
    method: 'GET',
  });

  const json = await res.json();
  if (json.errors) {
    console.error(json.errors);
    throw new Error('Failed to fetch API');
  }
  return Buffer.from(json.content, 'base64').toString();
}
