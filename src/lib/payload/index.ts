import type {
  Category,
  Author,
  HomePageShellData,
  Homepage,
} from '@/types/cms';
import { fetchAPI, type FetchApiOptions } from './base';

const AUTHOR_ID = 1; // quanghuy1242

export interface GetHomePageShellOptions {
  cache?: FetchApiOptions['cache'];
}

interface HomePageShellResponse {
  Categories: {
    docs: Category[];
  };
  Homepage: Homepage | null;
  User: Author | null;
}

interface HomepageHeaderResponse {
  Homepage: Pick<Homepage, 'header'> | null;
}

export async function getHomePageShell(
  options: GetHomePageShellOptions = {}
): Promise<HomePageShellData> {
  const data = await fetchAPI<HomePageShellResponse>(
    `#graphql
      query HomePageShell($authorId: Int!) {
        Categories(limit: 5, sort: "-updatedAt") {
          docs {
            id
            name
            description
            slug
            image {
              id
              url
              optimizedUrl
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
            optimizedUrl
            lowResUrl
            alt
          }
          meta {
            title
            description
            image {
              url
              optimizedUrl
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
      cache: options.cache,
    }
  );

  return {
    allCategories: data?.Categories?.docs ?? [],
    homepage: data?.Homepage ?? null,
    author: data?.User ?? null,
  };
}

export async function getHomepageHeader(
  options: Pick<FetchApiOptions, 'cache'> = {}
): Promise<Pick<Homepage, 'header'> | null> {
  const data = await fetchAPI<HomepageHeaderResponse>(
    `#graphql
      query HomepageHeader {
        Homepage {
          header
        }
      }
    `,
    {
      cache: options.cache,
    }
  );

  return data?.Homepage ?? null;
}
