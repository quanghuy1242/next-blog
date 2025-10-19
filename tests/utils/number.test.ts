import {
  normalizeLimit,
  normalizeOffset,
  stringifyValue,
} from 'common/utils/number';

describe('normalizeLimit', () => {
  const defaultLimit = 5;
  const maxLimit = 10;

  test('returns default when value is invalid', () => {
    expect(normalizeLimit('invalid', defaultLimit, maxLimit)).toBe(
      defaultLimit
    );
  });

  test('returns default when value is zero or negative', () => {
    expect(normalizeLimit('0', defaultLimit, maxLimit)).toBe(defaultLimit);
    expect(normalizeLimit('-3', defaultLimit, maxLimit)).toBe(defaultLimit);
  });

  test('caps value at the provided max', () => {
    expect(normalizeLimit('25', defaultLimit, maxLimit)).toBe(maxLimit);
  });

  test('returns parsed value when valid', () => {
    expect(normalizeLimit('7', defaultLimit, maxLimit)).toBe(7);
  });
});

describe('normalizeOffset', () => {
  test('returns zero for invalid, negative, or empty values', () => {
    expect(normalizeOffset('invalid')).toBe(0);
    expect(normalizeOffset('-4')).toBe(0);
    expect(normalizeOffset(undefined)).toBe(0);
  });

  test('parses positive numeric values', () => {
    expect(normalizeOffset('12')).toBe(12);
    expect(normalizeOffset(3)).toBe(3);
  });
});

describe('stringifyValue', () => {
  test('returns empty string for nullish values', () => {
    expect(stringifyValue(undefined)).toBe('');
    expect(stringifyValue(null)).toBe('');
  });

  test('returns first element when array provided', () => {
    expect(stringifyValue(['first', 'second'])).toBe('first');
  });

  test('converts primitives to strings', () => {
    expect(stringifyValue(42)).toBe('42');
    expect(stringifyValue(true)).toBe('true');
  });
});
