export type QueryParam = string | string[] | undefined;

export function normalizeQueryParam(param: QueryParam): string | null {
  if (Array.isArray(param)) {
    return normalizeQueryParam(param[0]);
  }

  if (typeof param !== 'string') {
    return null;
  }

  const trimmed = param.trim();

  return trimmed.length ? trimmed : null;
}

export function normalizeQueryParamList(param: QueryParam): string[] {
  const rawValues = Array.isArray(param)
    ? param
    : param !== undefined
      ? [param]
      : [];

  if (!rawValues.length) {
    return [];
  }

  const normalized = rawValues
    .map((value) => (typeof value === 'string' ? value : String(value)))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (!normalized.length) {
    return [];
  }

  return uniqueSortedStrings(normalized);
}

export function areStringArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const aSorted = uniqueSortedStrings(a);
  const bSorted = uniqueSortedStrings(b);

  for (let index = 0; index < aSorted.length; index += 1) {
    if (aSorted[index] !== bSorted[index]) {
      return false;
    }
  }

  return true;
}

export function uniqueSortedStrings(values: Iterable<string>): string[] {
  const normalized = Array.from(values, (value) => value.trim()).filter(
    (value) => value.length > 0
  );

  const unique = Array.from(new Set(normalized));

  unique.sort((first, second) => first.localeCompare(second));

  return unique;
}
