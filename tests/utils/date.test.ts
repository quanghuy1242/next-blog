import { describe, it, expect } from 'vitest';
import { formatDate } from 'common/utils/date';

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
