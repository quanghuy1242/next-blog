import type { Post as PostType } from 'types/datocms';

/**
 * Normalizes the optional `tags` field returned by CMS queries.
 * Supports comma-delimited strings and arrays, returning a trimmed list.
 */
export function normalizePostTags(
  tags: PostType['tags'] | null | undefined
): string[] {
  if (typeof tags === 'string') {
    return splitTags(tags);
  }

  if (Array.isArray(tags)) {
    return tags.filter((tag): tag is string => Boolean(tag?.trim()));
  }

  return [];
}

function splitTags(tags: string): string[] {
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}
