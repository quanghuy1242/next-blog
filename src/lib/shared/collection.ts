export function appendUniqueBy<T>(
  current: T[],
  incoming: T[],
  getKey: (item: T) => string | number
) {
  if (!incoming.length) {
    return current;
  }

  const seen = new Set(current.map(getKey));
  const merged = [...current];

  for (const item of incoming) {
    const key = getKey(item);

    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  return merged;
}
