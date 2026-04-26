const MAX_CONCURRENT_WARMUPS = 2;
const MAX_PENDING_WARMUPS = 32;
const MAX_TRACKED_WARMUPS = 128;
const RECENT_WARMUP_TTL_MS = 15 * 60 * 1000;

export type BookRouteWarmSource = 'hover' | 'viewport';

interface BookRouteWarmTask {
  href: string;
  source: BookRouteWarmSource;
  sequence: number;
  state: 'pending' | 'inflight';
  controller: AbortController | null;
  canceled: boolean;
}

const recentWarmups = new Map<string, number>();
const pendingWarmups: BookRouteWarmTask[] = [];
const inflightWarmups = new Set<string>();
const tasksByHref = new Map<string, BookRouteWarmTask>();

let activeWarmups = 0;
let warmupSequence = 0;

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

    return right.sequence - left.sequence;
  });
}

function touchWarmupTask(task: BookRouteWarmTask): void {
  task.sequence = ++warmupSequence;
}

function removePendingWarmup(task: BookRouteWarmTask): void {
  const index = pendingWarmups.indexOf(task);

  if (index >= 0) {
    pendingWarmups.splice(index, 1);
  }
}

function enqueueWarmup(task: BookRouteWarmTask): void {
  pendingWarmups.push(task);
  sortPendingWarmups();

  if (pendingWarmups.length > MAX_PENDING_WARMUPS) {
    pendingWarmups.length = MAX_PENDING_WARMUPS;
  }
}

function settleWarmupTask(task: BookRouteWarmTask): void {
  inflightWarmups.delete(task.href);
  activeWarmups = Math.max(0, activeWarmups - 1);

  if (tasksByHref.get(task.href) === task) {
    tasksByHref.delete(task.href);
  }

  drainWarmups();
}

function drainWarmups(): void {
  while (activeWarmups < MAX_CONCURRENT_WARMUPS) {
    const nextTask = pendingWarmups.shift();

    if (!nextTask) {
      return;
    }

    if (nextTask.canceled || tasksByHref.get(nextTask.href) !== nextTask) {
      continue;
    }

    if (inflightWarmups.has(nextTask.href) || hasRecentWarmup(nextTask.href)) {
      if (tasksByHref.get(nextTask.href) === nextTask) {
        tasksByHref.delete(nextTask.href);
      }
      continue;
    }

    nextTask.state = 'inflight';
    nextTask.controller = new AbortController();
    inflightWarmups.add(nextTask.href);
    activeWarmups += 1;

    void (async () => {
      try {
        const response = await fetch(nextTask.href, {
          credentials: 'same-origin',
          method: 'GET',
          signal: nextTask.controller?.signal,
        });

        if (response.ok && !nextTask.canceled && !nextTask.controller?.signal.aborted) {
          rememberWarmup(nextTask.href);
        }
      } catch (error) {
        if (
          !(error instanceof DOMException && error.name === 'AbortError') &&
          !(error instanceof Error && error.name === 'AbortError')
        ) {
          // Ignore network failures and aborts. Warmups are best-effort only.
        }
      } finally {
        settleWarmupTask(nextTask);
      }
    })();
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
    const existingTask = tasksByHref.get(normalizedHref);

    if (existingTask && getSourcePriority(source) > getSourcePriority(existingTask.source)) {
      existingTask.source = source;
      touchWarmupTask(existingTask);

      if (existingTask.state === 'pending') {
        sortPendingWarmups();
      }
    }

    return;
  }

  const existingTask = tasksByHref.get(normalizedHref);

  if (existingTask) {
    if (existingTask.canceled) {
      return;
    }

    if (getSourcePriority(source) > getSourcePriority(existingTask.source)) {
      existingTask.source = source;
      touchWarmupTask(existingTask);

      if (existingTask.state === 'pending') {
        sortPendingWarmups();
      }
    }

    return;
  }

  const task: BookRouteWarmTask = {
    href: normalizedHref,
    source,
    sequence: ++warmupSequence,
    state: 'pending',
    controller: null,
    canceled: false,
  };

  tasksByHref.set(normalizedHref, task);
  enqueueWarmup(task);

  drainWarmups();
}

export function cancelBookRouteWarmup(rawHref: string): void {
  pruneExpiredWarmups();

  const normalizedHref = normalizeBookRouteHref(rawHref);

  if (!normalizedHref) {
    return;
  }

  const task = tasksByHref.get(normalizedHref);

  if (!task || task.source === 'hover') {
    return;
  }

  task.canceled = true;

  if (task.state === 'pending') {
    removePendingWarmup(task);
    tasksByHref.delete(normalizedHref);
    return;
  }

  task.controller?.abort();
  tasksByHref.delete(normalizedHref);
}

export function clearBookRouteWarmupState(): void {
  for (const task of tasksByHref.values()) {
    task.canceled = true;
    task.controller?.abort();
  }

  recentWarmups.clear();
  pendingWarmups.length = 0;
  inflightWarmups.clear();
  tasksByHref.clear();
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
