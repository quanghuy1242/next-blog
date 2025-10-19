import { normalizePostTags } from 'common/utils/tags';

describe('normalizePostTags', () => {
  test('handles comma-delimited strings', () => {
    expect(normalizePostTags('one, two ,three')).toEqual([
      'one',
      'two',
      'three',
    ]);
  });

  test('filters out falsy or whitespace-only entries', () => {
    expect(normalizePostTags(['tag', ' ', null, undefined, 'another'])).toEqual([
      'tag',
      'another',
    ]);
  });

  test('returns empty array when input missing', () => {
    expect(normalizePostTags(undefined)).toEqual([]);
    expect(normalizePostTags(null)).toEqual([]);
  });
});
