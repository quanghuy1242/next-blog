import { describe, it, expect } from 'vitest';
import { formatDate, isValidDateString } from 'common/utils/date';

describe('formatDate', () => {
  it('formats ISO date string', () => {
    const result = formatDate('2024-01-15T10:30:00Z');
    // Result will be in local timezone, but should be consistent
    expect(result).toMatch(/January 1[45], 2024/);
  });

  it('uses custom format pattern', () => {
    const result = formatDate('2024-06-10T15:45:00Z', 'yyyy-MM-dd');
    expect(result).toMatch(/2024-06-(09|10)/);
  });

  it('returns empty string for empty input', () => {
    const result = formatDate('');
    expect(result).toBe('');
  });

  it('returns empty string for invalid date', () => {
    const result = formatDate('invalid-date');
    expect(result).toBe('');
  });

  it('handles date with timezone offset', () => {
    const result = formatDate('2024-12-25T23:59:59+05:30');
    expect(result).toMatch(/December 2[456], 2024/);
  });

  it('formats consistently with same input', () => {
    // This ensures the same date string produces the same output
    const dateString = '2024-07-04T12:00:00Z';
    const result1 = formatDate(dateString);
    const result2 = formatDate(dateString);
    expect(result1).toBe(result2);
    expect(result1).toMatch(/July [34], 2024/);
  });
});

describe('isValidDateString', () => {
  it('returns true for valid ISO date strings', () => {
    expect(isValidDateString('2024-01-15T10:30:00Z')).toBe(true);
    expect(isValidDateString('2024-03-20T00:00:00')).toBe(true);
    expect(isValidDateString('2024-12-31')).toBe(true);
  });

  it('returns false for invalid date strings', () => {
    expect(isValidDateString('invalid-date')).toBe(false);
    expect(isValidDateString('2024-13-45')).toBe(false);
    expect(isValidDateString('not a date')).toBe(false);
  });

  it('returns false for non-string values', () => {
    expect(isValidDateString(null)).toBe(false);
    expect(isValidDateString(undefined)).toBe(false);
    expect(isValidDateString(123)).toBe(false);
    expect(isValidDateString({})).toBe(false);
    expect(isValidDateString([])).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidDateString('')).toBe(false);
    expect(isValidDateString('   ')).toBe(false);
  });
});
