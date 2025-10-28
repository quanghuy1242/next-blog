import type { PostTag } from 'types/cms';

/**
 * Normalizes tags from various formats to string array.
 * Supports PostTag objects, comma-delimited strings and arrays, returning a trimmed list.
 */
export function normalizePostTags(
  tags:
    | (PostTag | string | null | undefined)[]
    | string[]
    | string
    | null
    | undefined
): string[] {
  if (!tags) {
    return [];
  }

  // Handle array of PostTag objects or strings
  if (Array.isArray(tags)) {
    return tags
      .map((t) => {
        if (typeof t === 'string') {
          return t.trim();
        }
        // Handle PostTag object
        if (
          t &&
          typeof t === 'object' &&
          'tag' in t &&
          typeof t.tag === 'string'
        ) {
          return t.tag.trim();
        }
        return '';
      })
      .filter((tag): tag is string => Boolean(tag));
  }

  // Handle comma-separated string
  if (typeof tags === 'string') {
    return splitTags(tags);
  }

  return [];
}

function splitTags(tags: string): string[] {
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}
