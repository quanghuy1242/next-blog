import { parseISO, isValid, format } from 'date-fns';

/**
 * Format a date string for display. Parses ISO 8601 date strings and formats them
 * using the local timezone. To prevent hydration mismatches, use suppressHydrationWarning
 * on the consuming component.
 *
 * @param dateString - ISO 8601 date string
 * @param formatPattern - date-fns format pattern (default: 'LLLL d, yyyy')
 * @returns Formatted date string in local timezone
 */
export function formatDate(
  dateString: string,
  formatPattern: string = 'LLLL d, yyyy'
): string {
  if (!dateString) {
    return '';
  }

  try {
    const date = parseISO(dateString);

    // Validate the parsed date
    if (!isValid(date)) {
      console.error('Invalid date:', dateString);
      return '';
    }

    // Format in local timezone (same behavior as original DatoCMS version)
    return format(date, formatPattern);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

/**
 * Validate if a string is a valid ISO 8601 date
 *
 * @param dateString - String to validate
 * @returns true if valid date string
 */
export function isValidDateString(dateString: unknown): dateString is string {
  if (typeof dateString !== 'string' || !dateString.trim()) {
    return false;
  }

  try {
    const date = parseISO(dateString);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
}
