import { fetchAPI } from './base';
import type { Category } from 'types/cms';

interface CategoryBySlugResponse {
  Categories: {
    docs: Category[];
  };
}

const categoryIdCache = new Map<string, number>();

export async function getCategoryIdBySlug(
  slug: string
): Promise<number | null> {
  const trimmedSlug = slug.trim();

  if (!trimmedSlug) {
    return null;
  }

  const cached = categoryIdCache.get(trimmedSlug);

  if (cached) {
    return cached;
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
    }
  );

  const category = data?.Categories?.docs?.[0] ?? null;
  const categoryId = category?.id ?? null;

  if (categoryId) {
    categoryIdCache.set(trimmedSlug, categoryId);
  }

  return categoryId;
}
