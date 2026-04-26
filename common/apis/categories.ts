import { fetchAPI } from './base';
import type { PayloadCacheSettings } from './cache';
import type { Category } from 'types/cms';

interface CategoryBySlugResponse {
  Categories: {
    docs: Category[];
  };
}

export async function getCategoryIdBySlug(
  slug: string,
  options: {
    cache?: PayloadCacheSettings;
  } = {}
): Promise<number | null> {
  const trimmedSlug = slug.trim();

  if (!trimmedSlug) {
    return null;
  }

  const data = await fetchAPI<CategoryBySlugResponse>(
    `#graphql
      query CategoryBySlug($slug: String!) {
        Categories(where: { slug: { equals: $slug } }, limit: 1) {
          docs {
            id
            slug
          }
        }
      }
    `,
    {
      variables: {
        slug: trimmedSlug,
      },
      cache: options.cache,
    }
  );

  const category = data?.Categories?.docs?.[0] ?? null;
  return category?.id ?? null;
}
