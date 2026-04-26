import { parseBookRouteSegment } from 'common/utils/book-route';

const MAX_CONCURRENT_WARMUPS = 2;
const MAX_PENDING_WARMUPS = 32;
const MAX_TRACKED_WARMUPS = 128;
const RECENT_WARMUP_TTL_MS = 15 * 60 * 1000;
const SHARED_WARMUP_RESPONSE_TTL_MS = 5 * 1000;

export type BookRouteWarmSource = 'hover' | 'pointer' | 'viewport';

interface BookRouteWarmTask {
  href: string;
  requestKey: string;
  source: BookRouteWarmSource;
  sequence: number;
  state: 'pending' | 'inflight';
  controller: AbortController | null;
  canceled: boolean;
}

interface NextDataState {
  buildId?: string;
  locale?: string;
  defaultLocale?: string;
}

const recentWarmups = new Map<string, number>();
const pendingWarmups: BookRouteWarmTask[] = [];
const inflightWarmups = new Set<string>();
const tasksByHref = new Map<string, BookRouteWarmTask>();
const sharedWarmupFetches = new Map<string, Promise<Response>>();
const sharedWarmupFetchExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

let activeWarmups = 0;
let warmupSequence = 0;
let nativeFetch: typeof fetch | null = null;
let fetchInterceptorInstalled = false;

function getSourcePriority(source: BookRouteWarmSource): number {
  switch (source) {
    case 'hover':
      return 3;
    case 'pointer':
      return 2;
    case 'viewport':
      return 1;
    default:
      return 1;
  }
}

function normalizePathname(pathname: string): string {
  if (pathname === '/') {
    return pathname;
  }

  return pathname.replace(/\/+$/, '');
}

function buildBookRouteDataSearch(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);

  if (segments[0] !== 'books') {
    return '';
  }

  const bookSegment = segments[1];
  const bookRoute = bookSegment ? parseBookRouteSegment(bookSegment) : null;

  if (!bookRoute?.bookSlug) {
    return '';
  }

  const searchParams = new URLSearchParams();
  searchParams.set('slug', bookSegment);

  if (segments.length === 4 && segments[2] === 'chapters' && segments[3]) {
    searchParams.set('chapterSlug', segments[3]);
  }

  return searchParams.toString();
}

function getNextDataState(): NextDataState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return (window as Window & { __NEXT_DATA__?: NextDataState }).__NEXT_DATA__ ?? null;
}

function buildBookRouteRequestKey(rawHref: string): string | null {
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

  const nextData = getNextDataState();
  const buildId = nextData?.buildId?.trim();
  const normalizedPathname = normalizePathname(url.pathname);

  if (!buildId) {
    return `${normalizedPathname}${url.search}`;
  }

  const routeDataSearch = buildBookRouteDataSearch(normalizedPathname);
  const extraSearch = url.search ? url.search.slice(1) : '';
  const combinedSearch = [routeDataSearch, extraSearch].filter(Boolean).join('&');

  const localePrefix =
    nextData?.locale &&
    nextData.locale !== nextData.defaultLocale &&
    !normalizedPathname.startsWith(`/${nextData.locale}/`)
      ? `/${nextData.locale}`
      : '';
  const routePath =
    normalizedPathname === '/'
      ? `${localePrefix}/index`
      : `${localePrefix}${normalizedPathname}`;
  return `/_next/data/${buildId}${routePath}.json${
    combinedSearch ? `?${combinedSearch}` : ''
  }`;
}

function getSharedWarmupFetchKey(
  input: RequestInfo | URL,
  init?: RequestInit
): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const method = init?.method ?? (input instanceof Request ? input.method : 'GET');

  if (method.toUpperCase() !== 'GET') {
    return null;
  }

  let rawUrl: string;

  if (typeof input === 'string') {
    rawUrl = input;
  } else if (input instanceof URL) {
    rawUrl = input.href;
  } else {
    rawUrl = input.url;
  }

  try {
    const normalizedUrl = new URL(rawUrl, window.location.href);

    if (normalizedUrl.origin !== window.location.origin) {
      return null;
    }

    return normalizedUrl.href;
  } catch {
    return null;
  }
}

function normalizeSharedWarmupFetchKey(rawKey: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return new URL(rawKey, window.location.href).href;
  } catch {
    return null;
  }
}

function installBookRouteFetchInterceptor(): void {
  if (
    fetchInterceptorInstalled ||
    typeof window === 'undefined' ||
    typeof window.fetch !== 'function'
  ) {
    return;
  }

  nativeFetch = window.fetch.bind(window);

  // Reuse the same in-flight request whenever the router asks for the same URL.
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const sharedKey = getSharedWarmupFetchKey(input, init);

    if (sharedKey) {
      const sharedPromise = sharedWarmupFetches.get(sharedKey);

      if (sharedPromise) {
        return sharedPromise.then((response) => response.clone());
      }
    }

    if (!nativeFetch) {
      return Promise.reject(new Error('Book route fetch interceptor is unavailable'));
    }

    return nativeFetch(input, init);
  }) as typeof fetch;

  fetchInterceptorInstalled = true;
}

function restoreBookRouteFetchInterceptor(): void {
  if (!fetchInterceptorInstalled || typeof window === 'undefined') {
    return;
  }

  if (nativeFetch) {
    window.fetch = nativeFetch;
  }

  nativeFetch = null;
  fetchInterceptorInstalled = false;
}

function registerSharedWarmupFetch(
  requestKey: string,
  promise: Promise<Response>
): void {
  const normalizedRequestKey = normalizeSharedWarmupFetchKey(requestKey);

  if (!normalizedRequestKey) {
    return;
  }

  sharedWarmupFetches.set(normalizedRequestKey, promise);

  const existingTimer = sharedWarmupFetchExpiryTimers.get(normalizedRequestKey);

  if (typeof existingTimer !== 'undefined') {
    clearTimeout(existingTimer);
    sharedWarmupFetchExpiryTimers.delete(normalizedRequestKey);
  }
}

function unregisterSharedWarmupFetch(
  requestKey: string,
  promise: Promise<Response>,
  retainForMs = 0
): void {
  const normalizedRequestKey = normalizeSharedWarmupFetchKey(requestKey);

  if (!normalizedRequestKey) {
    return;
  }

  const existingTimer = sharedWarmupFetchExpiryTimers.get(normalizedRequestKey);

  if (typeof existingTimer !== 'undefined') {
    clearTimeout(existingTimer);
    sharedWarmupFetchExpiryTimers.delete(normalizedRequestKey);
  }

  if (sharedWarmupFetches.get(normalizedRequestKey) !== promise) {
    return;
  }

  if (retainForMs <= 0) {
    sharedWarmupFetches.delete(normalizedRequestKey);
    return;
  }

  const expiryTimer = setTimeout(() => {
    if (sharedWarmupFetches.get(normalizedRequestKey) === promise) {
      sharedWarmupFetches.delete(normalizedRequestKey);
    }

    sharedWarmupFetchExpiryTimers.delete(normalizedRequestKey);
  }, retainForMs);

  sharedWarmupFetchExpiryTimers.set(normalizedRequestKey, expiryTimer);
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
    installBookRouteFetchInterceptor();

    // Start the actual network request once and let later callers attach to it.
    const requestInit: RequestInit = {
      credentials: 'same-origin',
      method: 'GET',
      signal: nextTask.controller?.signal,
    };

    if (nextTask.requestKey !== nextTask.href) {
      requestInit.headers = {
        'x-nextjs-data': '1',
      };
    }

    if (!nativeFetch) {
      throw new Error('Book route fetch interceptor is unavailable');
    }

    const requestPromise = nativeFetch(nextTask.requestKey, requestInit);

    registerSharedWarmupFetch(nextTask.requestKey, requestPromise);

    void (async () => {
      try {
        const response = await requestPromise;

        if (
          response.ok &&
          !nextTask.canceled &&
          !nextTask.controller?.signal.aborted
        ) {
          rememberWarmup(nextTask.href);
          unregisterSharedWarmupFetch(
            nextTask.requestKey,
            requestPromise,
            SHARED_WARMUP_RESPONSE_TTL_MS
          );
        } else {
          unregisterSharedWarmupFetch(nextTask.requestKey, requestPromise);
        }
      } catch (error) {
        if (
          !(error instanceof DOMException && error.name === 'AbortError') &&
          !(error instanceof Error && error.name === 'AbortError')
        ) {
          // Ignore network failures and aborts. Warmups are best-effort only.
        }
        unregisterSharedWarmupFetch(nextTask.requestKey, requestPromise);
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
    requestKey: buildBookRouteRequestKey(normalizedHref) ?? normalizedHref,
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

export function claimBookRouteWarmup(rawHref: string): void {
  pruneExpiredWarmups();

  const normalizedHref = normalizeBookRouteHref(rawHref);

  if (!normalizedHref) {
    return;
  }

  const task = tasksByHref.get(normalizedHref);

  if (!task || task.source === 'hover') {
    return;
  }

  task.source = 'hover';

  if (task.state === 'pending') {
    touchWarmupTask(task);
    sortPendingWarmups();
    drainWarmups();
  }
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
  sharedWarmupFetches.clear();
  for (const timerId of sharedWarmupFetchExpiryTimers.values()) {
    clearTimeout(timerId);
  }
  sharedWarmupFetchExpiryTimers.clear();
  activeWarmups = 0;
  restoreBookRouteFetchInterceptor();
}

export function getBookRouteWarmupState() {
  return {
    activeWarmups,
    inflightHrefs: Array.from(inflightWarmups),
    pendingHrefs: pendingWarmups.map((task) => task.href),
    recentHrefs: Array.from(recentWarmups.keys()),
  };
}
