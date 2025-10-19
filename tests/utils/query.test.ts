import {
  areStringArraysEqual,
  normalizeQueryParam,
  normalizeQueryParamList,
  uniqueSortedStrings,
} from 'common/utils/query';

describe('normalizeQueryParam', () => {
  test('returns null for undefined values', () => {
    expect(normalizeQueryParam(undefined)).toBeNull();
  });

  test('returns null for non-string values', () => {
    expect(normalizeQueryParam(123 as unknown as string)).toBeNull();
  });

  test('trims and returns single string', () => {
    expect(normalizeQueryParam('  hello ')).toBe('hello');
  });

  test('uses first element of array', () => {
    expect(normalizeQueryParam([' first ', 'second'])).toBe('first');
  });
});

describe('normalizeQueryParamList', () => {
  test('returns empty array for undefined', () => {
    expect(normalizeQueryParamList(undefined)).toEqual([]);
  });

  test('returns single value in array form', () => {
    expect(normalizeQueryParamList(' value ')).toEqual(['value']);
  });

  test('deduplicates, trims, and sorts values', () => {
    expect(
      normalizeQueryParamList(['  second', 'first ', 'second'])
    ).toEqual(['first', 'second']);
  });
});

describe('areStringArraysEqual', () => {
  test('returns true when arrays contain same values regardless of order', () => {
    expect(areStringArraysEqual(['b', 'a'], ['a', 'b'])).toBe(true);
  });

  test('returns false when lengths differ', () => {
    expect(areStringArraysEqual(['a'], ['a', 'b'])).toBe(false);
  });

  test('returns false when contents differ', () => {
    expect(areStringArraysEqual(['a', 'b'], ['a', 'c'])).toBe(false);
  });
});

describe('uniqueSortedStrings', () => {
  test('removes duplicates and sorts alphabetically', () => {
    expect(uniqueSortedStrings(['c', 'a', 'b', 'a'])).toEqual(['a', 'b', 'c']);
  });

  test('filters out empty or whitespace-only values', () => {
    expect(uniqueSortedStrings(['a', '', ' ', 'b'])).toEqual(['a', 'b']);
  });
});
