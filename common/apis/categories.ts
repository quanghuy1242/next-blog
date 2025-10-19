import { fetchAPI } from './base';

interface CategoryBySlugResponse {
  category: {
    id: string;
    slug: string;
  } | null;
}

const categoryIdCache = new Map<string, string>();

export async function getCategoryIdBySlug(slug: string): Promise<string | null> {
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
      query CategoryBySlug($slug: String) {
        category(filter: { slug: { eq: $slug } }) {
          id
          slug
        }
      }
    `,
    {
      variables: {
        slug: trimmedSlug,
      },
    }
  );

  const categoryId = data?.category?.id ?? null;

  if (categoryId) {
    categoryIdCache.set(trimmedSlug, categoryId);
  }

  return categoryId;
}
