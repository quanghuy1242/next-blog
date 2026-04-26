const MAX_CONCURRENT_WARMUPS = 2;
const MAX_PENDING_WARMUPS = 32;
const MAX_TRACKED_WARMUPS = 128;
const RECENT_WARMUP_TTL_MS = 15 * 60 * 1000;

export type BookRouteWarmSource = 'hover' | 'viewport';

interface BookRouteWarmTask {
  href: string;
  source: BookRouteWarmSource;
  scheduledAt: number;
}

const recentWarmups = new Map<string, number>();
const pendingWarmups: BookRouteWarmTask[] = [];
const inflightWarmups = new Set<string>();

let activeWarmups = 0;

function getSourcePriority(source: BookRouteWarmSource): number {
  return source === 'hover' ? 2 : 1;
}

function normalizePathname(pathname: string): string {
  if (pathname === '/') {
    return pathname;
  }

  return pathname.replace(/\/+$/, '');
}

function normalizeBookRouteHref(rawHref: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const trimmedHref = rawHref.trim();
  if (!trimmedHref) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(trimmedHref, window.location.href);
  } catch {
    return null;
  }

  if (url.origin !== window.location.origin) {
    return null;
  }

  const normalizedPathname = normalizePathname(url.pathname);
  const canonicalHref = `${normalizedPathname}${url.search}`;
  const currentHref = `${normalizePathname(window.location.pathname)}${window.location.search}`;

  if (canonicalHref === currentHref) {
    return null;
  }

  return canonicalHref;
}

function pruneExpiredWarmups(now = Date.now()): void {
  for (const [href, warmedAt] of recentWarmups.entries()) {
    if (now - warmedAt > RECENT_WARMUP_TTL_MS) {
      recentWarmups.delete(href);
    }
  }
}

function hasRecentWarmup(href: string, now = Date.now()): boolean {
  const warmedAt = recentWarmups.get(href);

  if (typeof warmedAt !== 'number') {
    return false;
  }

  if (now - warmedAt > RECENT_WARMUP_TTL_MS) {
    recentWarmups.delete(href);
    return false;
  }

  return true;
}

function rememberWarmup(href: string, warmedAt = Date.now()): void {
  recentWarmups.delete(href);
  recentWarmups.set(href, warmedAt);

  while (recentWarmups.size > MAX_TRACKED_WARMUPS) {
    const oldestHref = recentWarmups.keys().next().value as string | undefined;

    if (!oldestHref) {
      break;
    }

    recentWarmups.delete(oldestHref);
  }
}

function sortPendingWarmups(): void {
  pendingWarmups.sort((left, right) => {
    const priorityDifference =
      getSourcePriority(right.source) - getSourcePriority(left.source);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return left.scheduledAt - right.scheduledAt;
  });
}

function enqueueWarmup(task: BookRouteWarmTask): void {
  const existingIndex = pendingWarmups.findIndex(
    (candidate) => candidate.href === task.href
  );

  if (existingIndex >= 0) {
    const existingTask = pendingWarmups[existingIndex];

    if (getSourcePriority(task.source) > getSourcePriority(existingTask.source)) {
      existingTask.source = task.source;
      existingTask.scheduledAt = task.scheduledAt;
      sortPendingWarmups();
    }

    return;
  }

  pendingWarmups.push(task);
  sortPendingWarmups();

  if (pendingWarmups.length > MAX_PENDING_WARMUPS) {
    pendingWarmups.length = MAX_PENDING_WARMUPS;
  }
}

async function warmBookRoute(href: string): Promise<void> {
  try {
    const response = await fetch(href, {
      credentials: 'same-origin',
      method: 'GET',
    });

    if (!response.ok) {
      return;
    }

    rememberWarmup(href);
  } catch {
    // Warmups are opportunistic. A failed warmup should not block navigation.
  }
}

function drainWarmups(): void {
  while (activeWarmups < MAX_CONCURRENT_WARMUPS) {
    const nextTask = pendingWarmups.shift();

    if (!nextTask) {
      return;
    }

    const normalizedHref = normalizeBookRouteHref(nextTask.href);

    if (!normalizedHref) {
      continue;
    }

    if (inflightWarmups.has(normalizedHref) || hasRecentWarmup(normalizedHref)) {
      continue;
    }

    inflightWarmups.add(normalizedHref);
    activeWarmups += 1;

    void warmBookRoute(normalizedHref).finally(() => {
      inflightWarmups.delete(normalizedHref);
      activeWarmups -= 1;
      drainWarmups();
    });
  }
}

export function requestBookRouteWarmup(
  rawHref: string,
  source: BookRouteWarmSource = 'viewport'
): void {
  pruneExpiredWarmups();

  const normalizedHref = normalizeBookRouteHref(rawHref);

  if (!normalizedHref) {
    return;
  }

  if (hasRecentWarmup(normalizedHref) || inflightWarmups.has(normalizedHref)) {
    return;
  }

  enqueueWarmup({
    href: normalizedHref,
    source,
    scheduledAt: Date.now(),
  });

  drainWarmups();
}

export function clearBookRouteWarmupState(): void {
  recentWarmups.clear();
  pendingWarmups.length = 0;
  inflightWarmups.clear();
  activeWarmups = 0;
}

export function getBookRouteWarmupState() {
  return {
    activeWarmups,
    inflightHrefs: Array.from(inflightWarmups),
    pendingHrefs: pendingWarmups.map((task) => task.href),
    recentHrefs: Array.from(recentWarmups.keys()),
  };
}
