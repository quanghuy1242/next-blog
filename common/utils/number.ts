export function normalizeLimit(
  value: unknown,
  defaultValue: number,
  maxValue: number
): number {
  const parsed = parseInteger(value);

  if (parsed === null || parsed <= 0) {
    return defaultValue;
  }

  return Math.min(parsed, maxValue);
}

export function normalizeOffset(value: unknown): number {
  const parsed = parseInteger(value);

  if (parsed === null || parsed < 0) {
    return 0;
  }

  return parsed;
}

export function stringifyValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  if (value === undefined || value === null) {
    return '';
  }

  return String(value);
}

function parseInteger(value: unknown): number | null {
  const stringValue = stringifyValue(value);

  if (!stringValue) {
    return null;
  }

  const parsed = Number.parseInt(stringValue, 10);

  return Number.isNaN(parsed) ? null : parsed;
}
