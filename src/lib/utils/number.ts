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

export function parsePositiveInteger(
  value: unknown,
  name: string
): { ok: true; value: number } | { ok: false; error: string } {
  const stringValue = stringifyValue(value).trim();
  const parsed = stringValue.length > 0 ? Number(stringValue) : Number.NaN;

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { ok: false, error: `${name} must be a positive integer.` };
  }

  return { ok: true, value: parsed };
}

export function parseDelimitedPositiveIntegers(
  searchParams: URLSearchParams,
  keys: string[],
  {
    errorName,
    maxErrorName = errorName,
    maxValues,
  }: {
    errorName: string;
    maxErrorName?: string;
    maxValues?: number;
  }
): { ok: true; values: number[] } | { ok: false; error: string } {
  const rawValues = keys.flatMap((key) =>
    searchParams.getAll(key).flatMap((value) => value.split(','))
  );
  const trimmedValues = rawValues
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (maxValues != null && trimmedValues.length > maxValues) {
    return { ok: false, error: `At most ${maxValues} ${maxErrorName} are allowed.` };
  }

  const parsedValues = trimmedValues.map((value) => Number(value));

  if (parsedValues.some((value) => !Number.isInteger(value) || value <= 0)) {
    return { ok: false, error: `${errorName} must contain positive integers.` };
  }

  return { ok: true, values: uniquePositiveIntegers(parsedValues) };
}

export function uniquePositiveIntegers(values: number[]) {
  return Array.from(
    new Set(values.filter((value) => Number.isInteger(value) && value > 0))
  );
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
