import { parseBookRouteSegment } from 'common/utils/book-route';

/**
 * Scheduler and fetch-sharing state for book and chapter route warmups.
 *
 * Lifecycle overview:
 *
 * 1. A UI event such as hover, pointer proximity, or viewport visibility calls
 *    {@link requestBookRouteWarmup}.
 * 2. The href is normalized to a canonical same-origin route, then converted to
 *    the exact `/_next/data/...json?...` URL that the Next.js Pages Router will
 *    use for navigation when the build id is available.
 * 3. The scheduler puts that work into a small priority queue. Hover wins over
 *    pointer, and pointer wins over viewport. Only a small number of warmups
 *    are allowed to run at once so long lists do not flood the origin.
 * 4. When a warmup starts, this module installs a `window.fetch` interceptor.
 *    The interceptor is intentionally narrow: it only shares same-origin GET
 *    requests for book-related routes and their `/_next/data` equivalents.
 * 5. If a later caller asks for the same URL while the first fetch is still in
 *    progress, the interceptor returns a clone of the original response
 *    promise instead of starting a second network request.
 * 6. If the warmup completes successfully, the route is remembered in a short
 *    TTL registry so repeated hovers in the same session do not keep rewarming
 *    the same destination.
 * 7. If a click happens while a warmup is already in flight, the click claims
 *    that warmup so component cleanup does not abort it. If the task was only
 *    queued and had not started yet, the claim drops it so it cannot start too
 *    late and race behind the real navigation request.
 *
 * This module is intentionally client-only. On the server all entry points
 * return early because the scheduler depends on `window`, current location, and
 * the browser fetch implementation.
 */
const MAX_CONCURRENT_WARMUPS = 2;
const MAX_PENDING_WARMUPS = 32;
const MAX_TRACKED_WARMUPS = 128;
const RECENT_WARMUP_TTL_MS = 15 * 60 * 1000;
const SHARED_WARMUP_RESPONSE_TTL_MS = 5 * 1000;

export type BookRouteWarmSource = 'hover' | 'pointer' | 'viewport';

/**
 * A single scheduler entry keyed by canonical href.
 *
 * `href` is the human-facing canonical route such as `/books/1~sample-book`.
 * `requestKey` is the actual fetch URL, which is usually the Next data URL.
 * `source` drives priority.
 * `sequence` lets us favor newer tasks inside the same priority bucket.
 * `state` describes whether the task is still queued or already owns a fetch.
 * `controller` exists only after the task has started so inflight work can be
 * aborted when the originating signal goes stale.
 */
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

/**
 * Recently completed route warms, keyed by canonical href.
 *
 * This is not a browser-cache mirror. It is only a local hint that we already
 * warmed the route recently, so repeated hovers in the same session can be
 * ignored until the TTL expires.
 */
const recentWarmups = new Map<string, number>();

/**
 * Tasks waiting for a concurrency slot. Ordering is maintained by
 * {@link sortPendingWarmups}.
 */
const pendingWarmups: BookRouteWarmTask[] = [];

/**
 * Canonical hrefs that already own an inflight warmup request.
 */
const inflightWarmups = new Set<string>();

/**
 * The authoritative lookup table for task lifecycle by canonical href.
 *
 * A task can exist here while pending or inflight. Once it settles or gets
 * canceled, the entry is removed.
 */
const tasksByHref = new Map<string, BookRouteWarmTask>();

/**
 * Shared network requests keyed by fully normalized request URL.
 *
 * Each entry resolves to a preserved clone created as soon as the owner
 * request resolves. Later consumers clone that preserved copy instead of the
 * owner's original response, which avoids races once the owner starts reading
 * its body.
 */
const sharedWarmupFetches = new Map<string, Promise<Response>>();
const sharedWarmupFetchExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

let activeWarmups = 0;
let warmupSequence = 0;
let nativeFetch: typeof fetch | null = null;
let fetchInterceptorInstalled = false;

/**
 * Converts the UI signal into queue priority.
 *
 * The guiding rule is "intent beats speculation": hover is the strongest sign
 * of intent, pointer proximity is weaker, and viewport visibility is the most
 * speculative signal.
 */
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

/**
 * Builds the dynamic route query string that Next Pages Router appends to the
 * data URL for book and chapter routes.
 *
 * Example:
 * `/books/1~sample-book/chapters/intro`
 * becomes:
 * `slug=1%7Esample-book&chapterSlug=intro`
 *
 * `URLSearchParams` is used deliberately because it matches Next's own
 * serialization semantics, including its `%7E` encoding for `~`.
 */
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

/**
 * Converts a navigable href into the exact request URL we want to warm.
 *
 * When the Next build id is known, this returns the same `/_next/data` URL the
 * Pages Router uses during client navigation. That identity is what makes
 * fetch handoff possible. When the build id is unavailable, the function falls
 * back to the canonical route path so local tests and degraded environments
 * still behave sensibly.
 */
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

/**
 * Normalizes a fetch call into a fully qualified same-origin GET key.
 *
 * The fetch interceptor uses this to determine whether a later caller is
 * asking for exactly the same resource as an already shared request.
 */
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

/**
 * Converts a relative or absolute request key into one stable absolute URL.
 *
 * Shared fetch registration always uses the normalized absolute form so calls
 * like `/books/x` and `https://site.test/books/x` cannot create parallel map
 * entries for the same underlying resource.
 */
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

/**
 * Restricts fetch sharing to the small surface this feature owns.
 *
 * We intentionally do not share every same-origin GET. Only book-route page
 * URLs and their Next data equivalents are eligible, which keeps the
 * interception behavior predictable and local to this feature.
 */
function shouldShareBookRouteFetchKey(rawKey: string): boolean {
  const normalizedKey = normalizeSharedWarmupFetchKey(rawKey);

  if (!normalizedKey) {
    return false;
  }

  try {
    const url = new URL(normalizedKey, window.location.href);
    const pathname = normalizePathname(url.pathname);

    if (pathname.startsWith('/_next/data/')) {
      return pathname.includes('/books/') && pathname.endsWith('.json');
    }

    return pathname === '/books' || pathname.startsWith('/books/');
  } catch {
    return false;
  }
}

/**
 * Monkey-patches `window.fetch` so matching later requests can reuse the first
 * response promise instead of going back to the network.
 *
 * Important behavior:
 *
 * - The patch is lazy. It is installed only when the first warmup actually
 *   starts.
 * - Sharing happens by normalized URL match, not by "this came from a warmup"
 *   identity. That means even a router-triggered fetch can become the shared
 *   owner if it reaches the interceptor first.
 * - Shared responses are always cloned for consumers because multiple readers
 *   may need to consume the body independently.
 * - The share table stores a clone created immediately when the owner
 *   response resolves, not the owner's original `Response`.
 */
function installBookRouteFetchInterceptor(): void {
  if (
    fetchInterceptorInstalled ||
    typeof window === 'undefined' ||
    typeof window.fetch !== 'function'
  ) {
    return;
  }

  nativeFetch = window.fetch.bind(window);

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const sharedKey = getSharedWarmupFetchKey(input, init);

    if (sharedKey) {
      const sharedPromise = sharedWarmupFetches.get(sharedKey);

      if (sharedPromise) {
        // A matching request is already inflight. Hand back a cloned response
        // so the later caller can consume the body independently.
        return sharedPromise.then((response) => response.clone());
      }
    }

    if (!nativeFetch) {
      return Promise.reject(new Error('Book route fetch interceptor is unavailable'));
    }

    const requestPromise = nativeFetch(input, init);

    if (sharedKey && shouldShareBookRouteFetchKey(sharedKey)) {
      const sharedResponsePromise = requestPromise.then((response) => response.clone());

      // Whichever caller starts the first eligible request becomes the shared
      // owner. Later identical requests will attach to this promise.
      registerSharedWarmupFetch(sharedKey, sharedResponsePromise);

      void sharedResponsePromise
        .then((response) => {
          unregisterSharedWarmupFetch(
            sharedKey,
            sharedResponsePromise,
            response.ok ? SHARED_WARMUP_RESPONSE_TTL_MS : 0
          );
        })
        .catch(() => {
          unregisterSharedWarmupFetch(sharedKey, sharedResponsePromise);
        });
    }

    return requestPromise;
  }) as typeof fetch;

  fetchInterceptorInstalled = true;
}

/**
 * Restores the browser's original fetch implementation.
 *
 * The module keeps the interceptor installed while warmup state is active.
 * Tests and explicit cleanup use this to guarantee isolation between runs.
 */
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

/**
 * Publishes a preserved shared response into the shared request table.
 *
 * Re-registering the same key clears any previous expiry timer. This matters
 * when a recently completed request becomes active again before its retention
 * window expires.
 */
function registerSharedWarmupFetch(
  requestKey: string,
  preservedResponsePromise: Promise<Response>
): void {
  const normalizedRequestKey = normalizeSharedWarmupFetchKey(requestKey);

  if (!normalizedRequestKey) {
    return;
  }

  sharedWarmupFetches.set(normalizedRequestKey, preservedResponsePromise);

  const existingTimer = sharedWarmupFetchExpiryTimers.get(normalizedRequestKey);

  if (typeof existingTimer !== 'undefined') {
    clearTimeout(existingTimer);
    sharedWarmupFetchExpiryTimers.delete(normalizedRequestKey);
  }
}

/**
 * Removes a shared request immediately or after a short retention period.
 *
 * The retention window lets a click that happens just after a warmup resolved
 * reuse the already-fetched response instead of immediately issuing a second
 * network request.
 */
function unregisterSharedWarmupFetch(
  requestKey: string,
  preservedResponsePromise: Promise<Response>,
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

  if (sharedWarmupFetches.get(normalizedRequestKey) !== preservedResponsePromise) {
    return;
  }

  if (retainForMs <= 0) {
    sharedWarmupFetches.delete(normalizedRequestKey);
    return;
  }

  const expiryTimer = setTimeout(() => {
    if (
      sharedWarmupFetches.get(normalizedRequestKey) === preservedResponsePromise
    ) {
      sharedWarmupFetches.delete(normalizedRequestKey);
    }

    sharedWarmupFetchExpiryTimers.delete(normalizedRequestKey);
  }, retainForMs);

  sharedWarmupFetchExpiryTimers.set(normalizedRequestKey, expiryTimer);
}

/**
 * Normalizes a candidate href into the canonical same-origin route we track.
 *
 * This strips trailing slashes, rejects malformed or external URLs, and avoids
 * warming the page the user is already on.
 */
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

/**
 * Drops recently warmed entries once their TTL expires.
 */
function pruneExpiredWarmups(now = Date.now()): void {
  for (const [href, warmedAt] of recentWarmups.entries()) {
    if (now - warmedAt > RECENT_WARMUP_TTL_MS) {
      recentWarmups.delete(href);
    }
  }
}

/**
 * Returns whether the canonical href was warmed recently enough to skip a new
 * warmup request.
 */
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

/**
 * Records a successful warmup and maintains the bounded LRU-like registry.
 */
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

/**
 * Orders pending work by priority first, then by recency inside the same
 * priority class.
 */
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

/**
 * Bumps a task's recency marker whenever new user intent arrives for it.
 */
function touchWarmupTask(task: BookRouteWarmTask): void {
  task.sequence = ++warmupSequence;
}

/**
 * Removes a task from the pending queue without touching other state tables.
 */
function removePendingWarmup(task: BookRouteWarmTask): void {
  const index = pendingWarmups.indexOf(task);

  if (index >= 0) {
    pendingWarmups.splice(index, 1);
  }
}

/**
 * Pushes work into the queue and trims old low-value tail entries if the queue
 * grows beyond the configured cap.
 */
function enqueueWarmup(task: BookRouteWarmTask): void {
  pendingWarmups.push(task);
  sortPendingWarmups();

  if (pendingWarmups.length > MAX_PENDING_WARMUPS) {
    pendingWarmups.length = MAX_PENDING_WARMUPS;
  }
}

/**
 * Finalizes a task after success, failure, or cancellation and then gives the
 * scheduler a chance to start more work.
 */
function settleWarmupTask(task: BookRouteWarmTask): void {
  inflightWarmups.delete(task.href);
  activeWarmups = Math.max(0, activeWarmups - 1);

  if (tasksByHref.get(task.href) === task) {
    tasksByHref.delete(task.href);
  }

  drainWarmups();
}

/**
 * Main scheduler loop.
 *
 * This function keeps pulling from the queue until the concurrency pool is
 * full or there is no eligible work left. A task may be skipped here even if
 * it was valid when enqueued, for example because:
 *
 * - it was canceled while waiting,
 * - it was replaced by newer task state,
 * - another inflight request now owns the same href, or
 * - the route finished warming recently enough that another warm is pointless.
 */
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

    // Once the task owns a slot, it also owns an AbortController so stale
    // viewport/pointer work can be canceled if the originating UI state goes
    // away before the fetch finishes.
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

    const requestPromise = window.fetch(nextTask.requestKey, requestInit);

    void (async () => {
      try {
        const response = await requestPromise;

        if (
          response.ok &&
          !nextTask.canceled &&
          !nextTask.controller?.signal.aborted
        ) {
          rememberWarmup(nextTask.href);
        }
      } catch (error) {
        if (
          !(error instanceof DOMException && error.name === 'AbortError') &&
          !(error instanceof Error && error.name === 'AbortError')
        ) {
          // Warmups are opportunistic. They should never surface visible errors
          // because navigation itself will still perform its own real request.
        }
      } finally {
        settleWarmupTask(nextTask);
      }
    })();
  }
}

/**
 * Requests a warmup for a book or chapter route.
 *
 * This is the normal entry point for UI code. The function is intentionally
 * idempotent from the caller's perspective:
 *
 * - duplicate requests for a recent or inflight route are ignored,
 * - stronger intent can upgrade an existing task's priority,
 * - malformed, external, or self-targeting hrefs are ignored.
 *
 * @param rawHref Human-facing href such as `/books/1~sample-book`.
 * @param source UI signal that triggered the request. Higher intent gets
 * higher queue priority.
 */
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

/**
 * Claims an existing warmup because a real navigation is about to happen.
 *
 * Behavior depends on task state:
 *
 * - `inflight`: keep the task alive by upgrading it to hover priority so later
 *   cleanup from viewport/pointer observers does not abort the request.
 * - `pending`: drop the queued task entirely. The real navigation request is
 *   already happening, so allowing the stale queued warmup to start later would
 *   create a second fetch instead of helping.
 */
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

  if (task.state === 'pending') {
    task.canceled = true;
    removePendingWarmup(task);
    tasksByHref.delete(normalizedHref);
    return;
  }

  task.source = 'hover';
}

/**
 * Cancels speculative work once the UI signal that justified it disappears.
 *
 * Hover-claimed work is intentionally immune here because after a click it is
 * no longer speculative. Pending tasks are simply removed from the queue;
 * inflight tasks are aborted through their controller.
 */
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

/**
 * Resets all scheduler and fetch-sharing state.
 *
 * This is mainly used by tests, but it is also the single place that guarantees
 * the original browser fetch implementation is restored.
 */
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

/**
 * Exposes a small snapshot of internal scheduler state for tests and manual
 * debugging.
 */
export function getBookRouteWarmupState() {
  return {
    activeWarmups,
    inflightHrefs: Array.from(inflightWarmups),
    pendingHrefs: pendingWarmups.map((task) => task.href),
    recentHrefs: Array.from(recentWarmups.keys()),
  };
}
