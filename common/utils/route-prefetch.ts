// Next.js does not publish a stable public entrypoint for these Pages Router
// helpers. Keep the internal dependency narrow and covered by tests that
// compare our request key against Next's own PageLoader data URL generation.
import { getRouteMatcher } from 'next/dist/shared/lib/router/utils/route-matcher';
import { getRouteRegex } from 'next/dist/shared/lib/router/utils/route-regex';

/**
 * Scheduler and fetch-sharing state for route warmups.
 *
 * This implementation is intentionally tied to the Next.js Pages Router data
 * fetching model. It derives route params from the client page manifest and
 * warms the `/_next/data/...json` request that Pages Router navigation uses.
 * If this project migrates to App Router, this module should be updated to
 * target that router's prefetch and data-loading contract instead of assuming
 * `/_next/data`.
 *
 * Lifecycle overview:
 *
 * 1. A UI event such as hover, pointer proximity, or viewport visibility calls
 *    {@link requestRouteWarmup}.
 * 2. The href is normalized to a canonical same-origin route, then converted to
 *    the exact `/_next/data/...json?...` URL that the Next.js Pages Router will
 *    use for navigation when the build id is available.
 * 3. The scheduler puts that work into a small priority queue. Hover wins over
 *    pointer, and pointer wins over viewport. Only a small number of warmups
 *    are allowed to run at once so long lists do not flood the origin.
 * 4. When a warmup starts, this module installs a `window.fetch` interceptor.
 *    The interceptor is intentionally narrow: it only shares same-origin GET
 *    requests for the currently supported route family and their
 *    `/_next/data` equivalents.
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

export type RouteWarmSource = 'hover' | 'pointer' | 'viewport';

/**
 * A single scheduler entry keyed by canonical href.
 *
 * `href` is the human-facing canonical route such as `/articles/sample-post`.
 * `requestKey` is the actual fetch URL, which is usually the Next data URL.
 * `source` drives priority.
 * `sequence` lets us favor newer tasks inside the same priority bucket.
 * `state` describes whether the task is still queued or already owns a fetch.
 * `controller` exists only after the task has started so inflight work can be
 * aborted when the originating signal goes stale.
 */
interface RouteWarmTask {
  href: string;
  requestKey: string;
  source: RouteWarmSource;
  sequence: number;
  state: 'pending' | 'inflight';
  controller: AbortController | null;
  canceled: boolean;
  claimedByNavigation: boolean;
}

interface NextDataState {
  buildId?: string;
  locale?: string;
  defaultLocale?: string;
}

interface ClientBuildManifestState {
  sortedPages?: string[];
}

interface DevPagesManifestState {
  pages?: string[];
}

interface NetworkInformationState {
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
  addListener?: (listener: () => void) => void;
  removeListener?: (listener: () => void) => void;
}

interface RouteWarmupPolicyState {
  allowHoverWarmup: boolean;
  allowPointerWarmup: boolean;
  allowViewportWarmup: boolean;
  disableWarmup: boolean;
  pauseSpeculativeWarmup: boolean;
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
const pendingWarmups: RouteWarmTask[] = [];

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
const tasksByHref = new Map<string, RouteWarmTask>();

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
let pauseSpeculativeWarmupAfterNavigation = false;
let connectionListenerState:
  | {
      connection: NetworkInformationState;
      listener: () => void;
    }
  | null = null;
let resumeListenersAttached = false;
let cachedRouteWarmupPolicyState: RouteWarmupPolicyState | null = null;

const routeWarmupPolicySubscribers = new Set<() => void>();

function notifyRouteWarmupPolicySubscribers(): void {
  for (const subscriber of routeWarmupPolicySubscribers) {
    subscriber();
  }
}

function getNavigatorConnection(): NetworkInformationState | null {
  if (typeof navigator === 'undefined') {
    return null;
  }

  const browserNavigator = navigator as Navigator & {
    connection?: NetworkInformationState;
    mozConnection?: NetworkInformationState;
    webkitConnection?: NetworkInformationState;
  };

  return (
    browserNavigator.connection ??
    browserNavigator.mozConnection ??
    browserNavigator.webkitConnection ??
    null
  );
}

function isConnectionConstrained(connection = getNavigatorConnection()): boolean {
  const effectiveType = connection?.effectiveType?.toLowerCase();

  return (
    Boolean(connection?.saveData) ||
    effectiveType === 'slow-2g' ||
    effectiveType === '2g'
  );
}

function handleRouteWarmupPolicyConnectionChange(): void {
  notifyRouteWarmupPolicySubscribers();
}

function attachConnectionListener(): void {
  const connection = getNavigatorConnection();

  if (!connection) {
    if (connectionListenerState) {
      detachConnectionListener();
    }
    return;
  }

  if (connectionListenerState?.connection === connection) {
    return;
  }

  detachConnectionListener();

  const listener = handleRouteWarmupPolicyConnectionChange;

  if (typeof connection.addEventListener === 'function') {
    connection.addEventListener('change', listener);
  } else if (typeof connection.addListener === 'function') {
    connection.addListener(listener);
  } else {
    return;
  }

  connectionListenerState = {
    connection,
    listener,
  };
}

function detachConnectionListener(): void {
  if (!connectionListenerState) {
    return;
  }

  const { connection, listener } = connectionListenerState;

  if (typeof connection.removeEventListener === 'function') {
    connection.removeEventListener('change', listener);
  } else if (typeof connection.removeListener === 'function') {
    connection.removeListener(listener);
  }

  connectionListenerState = null;
}

function resumeSpeculativeRouteWarmups(): void {
  if (!pauseSpeculativeWarmupAfterNavigation) {
    return;
  }

  pauseSpeculativeWarmupAfterNavigation = false;
  detachSpeculativeWarmupResumeListeners();
  notifyRouteWarmupPolicySubscribers();
}

function handleSpeculativeWarmupResumeActivity(): void {
  resumeSpeculativeRouteWarmups();
}

function attachSpeculativeWarmupResumeListeners(): void {
  if (resumeListenersAttached || typeof window === 'undefined') {
    return;
  }

  window.addEventListener('pointermove', handleSpeculativeWarmupResumeActivity, {
    capture: true,
    passive: true,
  });
  // Mousemove is a fallback for browsers or embedding contexts that do not
  // reliably deliver Pointer Events to the top-level window.
  window.addEventListener('mousemove', handleSpeculativeWarmupResumeActivity, {
    capture: true,
    passive: true,
  });
  window.addEventListener('touchstart', handleSpeculativeWarmupResumeActivity, {
    capture: true,
    passive: true,
  });
  // Scroll is only an approximation of renewed intent. Browser or framework
  // scroll restoration can also trigger it, so this may resume speculation
  // slightly earlier than ideal.
  window.addEventListener('scroll', handleSpeculativeWarmupResumeActivity, {
    capture: true,
    passive: true,
  });
  window.addEventListener('wheel', handleSpeculativeWarmupResumeActivity, {
    capture: true,
    passive: true,
  });
  window.addEventListener('keydown', handleSpeculativeWarmupResumeActivity, {
    capture: true,
  });

  resumeListenersAttached = true;
}

function detachSpeculativeWarmupResumeListeners(): void {
  if (!resumeListenersAttached || typeof window === 'undefined') {
    return;
  }

  window.removeEventListener(
    'pointermove',
    handleSpeculativeWarmupResumeActivity,
    true
  );
  window.removeEventListener(
    'mousemove',
    handleSpeculativeWarmupResumeActivity,
    true
  );
  window.removeEventListener(
    'touchstart',
    handleSpeculativeWarmupResumeActivity,
    true
  );
  window.removeEventListener(
    'scroll',
    handleSpeculativeWarmupResumeActivity,
    true
  );
  window.removeEventListener(
    'wheel',
    handleSpeculativeWarmupResumeActivity,
    true
  );
  window.removeEventListener(
    'keydown',
    handleSpeculativeWarmupResumeActivity,
    true
  );

  resumeListenersAttached = false;
}

export function getRouteWarmupPolicyState(): RouteWarmupPolicyState {
  const disableWarmup = isConnectionConstrained();
  const nextRouteWarmupPolicyState: RouteWarmupPolicyState = {
    allowHoverWarmup: !disableWarmup,
    allowPointerWarmup:
      !disableWarmup && !pauseSpeculativeWarmupAfterNavigation,
    allowViewportWarmup:
      !disableWarmup && !pauseSpeculativeWarmupAfterNavigation,
    disableWarmup,
    pauseSpeculativeWarmup: pauseSpeculativeWarmupAfterNavigation,
  };

  if (
    cachedRouteWarmupPolicyState &&
    cachedRouteWarmupPolicyState.allowHoverWarmup ===
      nextRouteWarmupPolicyState.allowHoverWarmup &&
    cachedRouteWarmupPolicyState.allowPointerWarmup ===
      nextRouteWarmupPolicyState.allowPointerWarmup &&
    cachedRouteWarmupPolicyState.allowViewportWarmup ===
      nextRouteWarmupPolicyState.allowViewportWarmup &&
    cachedRouteWarmupPolicyState.disableWarmup ===
      nextRouteWarmupPolicyState.disableWarmup &&
    cachedRouteWarmupPolicyState.pauseSpeculativeWarmup ===
      nextRouteWarmupPolicyState.pauseSpeculativeWarmup
  ) {
    return cachedRouteWarmupPolicyState;
  }

  cachedRouteWarmupPolicyState = nextRouteWarmupPolicyState;

  return cachedRouteWarmupPolicyState;
}

export function subscribeRouteWarmupPolicy(
  subscriber: () => void
): () => void {
  routeWarmupPolicySubscribers.add(subscriber);
  attachConnectionListener();

  return () => {
    routeWarmupPolicySubscribers.delete(subscriber);

    if (routeWarmupPolicySubscribers.size === 0) {
      detachConnectionListener();
    }
  };
}

export function pauseSpeculativeRouteWarmupsUntilUserActivity(): void {
  if (typeof window === 'undefined' || pauseSpeculativeWarmupAfterNavigation) {
    return;
  }

  pauseSpeculativeWarmupAfterNavigation = true;
  attachSpeculativeWarmupResumeListeners();
  notifyRouteWarmupPolicySubscribers();
}

/**
 * Converts the UI signal into queue priority.
 *
 * The guiding rule is "intent beats speculation": hover is the strongest sign
 * of intent, pointer proximity is weaker, and viewport visibility is the most
 * speculative signal.
 */
function getSourcePriority(source: RouteWarmSource): number {
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

function getCanonicalWarmupHref(rawHref: string): string | null {
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

  return `${normalizedPathname}${url.search}`;
}

/**
 * Builds the dynamic route query string that Next Pages Router appends to the
 * data URL for the currently supported route family.
 *
 * Example:
 * `/articles/sample-post`
 * becomes:
 * `slug=sample-post`
 *
 * `URLSearchParams` is used deliberately because it matches Next's own
 * serialization semantics, including its `%7E` encoding for `~`.
 */
function getClientRoutePatterns(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const globalWindow = window as Window & {
    __BUILD_MANIFEST?: ClientBuildManifestState;
    __DEV_PAGES_MANIFEST?: DevPagesManifestState;
  };

  return (
    globalWindow.__BUILD_MANIFEST?.sortedPages ??
    globalWindow.__DEV_PAGES_MANIFEST?.pages ??
    []
  );
}

function stripLocalePrefix(pathname: string, nextData: NextDataState | null): string {
  const locale = nextData?.locale;
  const defaultLocale = nextData?.defaultLocale;

  if (!locale || locale === defaultLocale) {
    return pathname;
  }

  if (pathname === `/${locale}`) {
    return '/';
  }

  if (pathname.startsWith(`/${locale}/`)) {
    return pathname.slice(locale.length + 1) || '/';
  }

  return pathname;
}

function normalizeDataRoutePath(routePath: string): string {
  if (routePath === '/index') {
    return '/';
  }

  return routePath;
}

function normalizeRoutePathnameForMatching(pathname: string): string {
  return stripLocalePrefix(normalizePathname(pathname), getNextDataState());
}

function findMatchingRoutePattern(routePathname: string): string | null {
  const normalizedRoutePathname = normalizeRoutePathnameForMatching(routePathname);

  for (const pattern of getClientRoutePatterns()) {
    if (pattern === normalizedRoutePathname) {
      return pattern;
    }

    const routeRegex = getRouteRegex(pattern);

    if (routeRegex.re.test(normalizedRoutePathname)) {
      return pattern;
    }
  }

  return null;
}

function buildRouteDataSearch(pathname: string): string {
  const routePathname = normalizeRoutePathnameForMatching(pathname);
  const matchingPattern = findMatchingRoutePattern(routePathname);

  if (!matchingPattern) {
    return '';
  }

  const params = getRouteMatcher(getRouteRegex(matchingPattern))(routePathname);

  if (!params) {
    return '';
  }

  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'undefined') {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        searchParams.append(key, entry);
      }
      continue;
    }

    searchParams.set(key, value);
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
 *
 * This request-key strategy is Pages Router specific. App Router migration
 * would require revisiting this function because App Router does not expose the
 * same `/_next/data` navigation contract.
 */
function buildRouteRequestKey(rawHref: string): string | null {
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

  const routeDataSearch = buildRouteDataSearch(normalizedPathname);
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
 * like `/articles/x` and `https://site.test/articles/x` cannot create parallel
 * map entries for the same underlying resource.
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
 * Restricts fetch sharing to the route surface this feature owns.
 *
 * We intentionally do not share every same-origin GET. Only the currently
 * supported route family and its Next data equivalents are eligible, which
 * keeps the interception behavior predictable and local to this feature.
 */
function shouldShareRouteFetchKey(rawKey: string): boolean {
  const normalizedKey = normalizeSharedWarmupFetchKey(rawKey);

  if (!normalizedKey) {
    return false;
  }

  try {
    const url = new URL(normalizedKey, window.location.href);
    const pathname = normalizePathname(url.pathname);

    if (pathname.startsWith('/_next/data/')) {
      const routePath = extractRoutePathFromDataUrl(pathname);

      return routePath ? Boolean(findMatchingRoutePattern(routePath)) : false;
    }

    return Boolean(findMatchingRoutePattern(pathname));
  } catch {
    return false;
  }
}

function extractRoutePathFromDataUrl(pathname: string): string | null {
  const dataPrefix = '/_next/data/';

  if (!pathname.startsWith(dataPrefix) || !pathname.endsWith('.json')) {
    return null;
  }

  const afterPrefix = pathname.slice(dataPrefix.length);
  const firstSlashIndex = afterPrefix.indexOf('/');

  if (firstSlashIndex < 0) {
    return null;
  }

  const routePath = afterPrefix.slice(firstSlashIndex, -'.json'.length);

  return normalizeDataRoutePath(routePath);
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
function installWarmupFetchInterceptor(): void {
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
      return Promise.reject(new Error('Warmup fetch interceptor is unavailable'));
    }

    const requestPromise = nativeFetch(input, init);

    if (sharedKey && shouldShareRouteFetchKey(sharedKey)) {
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
function restoreWarmupFetchInterceptor(): void {
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
function normalizeWarmupHref(rawHref: string): string | null {
  const canonicalHref = getCanonicalWarmupHref(rawHref);
  if (!canonicalHref) {
    return null;
  }
  const currentHref = `${normalizePathname(window.location.pathname)}${window.location.search}`;

  if (canonicalHref === currentHref) {
    return null;
  }

  return canonicalHref;
}

export function isSameWarmupHref(rawHref: string): boolean {
  const canonicalHref = getCanonicalWarmupHref(rawHref);

  if (!canonicalHref) {
    return false;
  }

  const currentHref = `${normalizePathname(window.location.pathname)}${window.location.search}`;

  return canonicalHref === currentHref;
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
function touchWarmupTask(task: RouteWarmTask): void {
  task.sequence = ++warmupSequence;
}

/**
 * Removes a task from the pending queue without touching other state tables.
 */
function removePendingWarmup(task: RouteWarmTask): void {
  const index = pendingWarmups.indexOf(task);

  if (index >= 0) {
    pendingWarmups.splice(index, 1);
  }
}

/**
 * Pushes work into the queue and trims old low-value tail entries if the queue
 * grows beyond the configured cap.
 */
function enqueueWarmup(task: RouteWarmTask): void {
  pendingWarmups.push(task);
  sortPendingWarmups();

  if (pendingWarmups.length > MAX_PENDING_WARMUPS) {
    const droppedWarmups = pendingWarmups.splice(MAX_PENDING_WARMUPS);

    for (const droppedWarmup of droppedWarmups) {
      droppedWarmup.canceled = true;

      if (tasksByHref.get(droppedWarmup.href) === droppedWarmup) {
        tasksByHref.delete(droppedWarmup.href);
      }
    }
  }
}

/**
 * Finalizes a task after success, failure, or cancellation and then gives the
 * scheduler a chance to start more work.
 */
function settleWarmupTask(task: RouteWarmTask): void {
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
    installWarmupFetchInterceptor();

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
 * Requests a warmup for a route.
 *
 * This is the normal entry point for UI code. The function is intentionally
 * idempotent from the caller's perspective:
 *
 * - duplicate requests for a recent or inflight route are ignored,
 * - stronger intent can upgrade an existing task's priority,
 * - malformed, external, or self-targeting hrefs are ignored.
 *
 * @param rawHref Human-facing href such as `/articles/sample-post`.
 * @param source UI signal that triggered the request. Higher intent gets
 * higher queue priority.
 */
export function requestRouteWarmup(
  rawHref: string,
  source: RouteWarmSource = 'viewport'
): void {
  pruneExpiredWarmups();

  const routeWarmupPolicyState = getRouteWarmupPolicyState();

  if (routeWarmupPolicyState.disableWarmup) {
    return;
  }

  if (routeWarmupPolicyState.pauseSpeculativeWarmup) {
    if (source === 'hover') {
      resumeSpeculativeRouteWarmups();
    } else {
      return;
    }
  }

  const normalizedHref = normalizeWarmupHref(rawHref);

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

  const task: RouteWarmTask = {
    href: normalizedHref,
    requestKey: buildRouteRequestKey(normalizedHref) ?? normalizedHref,
    source,
    sequence: ++warmupSequence,
    state: 'pending',
    controller: null,
    canceled: false,
    claimedByNavigation: false,
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
 * - `inflight`: mark the task as owned by real navigation so later speculative
 *   cleanup does not abort the request.
 * - `pending`: drop the queued task entirely. The real navigation request is
 *   already happening, so allowing the stale queued warmup to start later would
 *   create a second fetch instead of helping.
 */
export function claimRouteWarmup(rawHref: string): void {
  pruneExpiredWarmups();

  const normalizedHref = normalizeWarmupHref(rawHref);

  if (!normalizedHref) {
    return;
  }

  const task = tasksByHref.get(normalizedHref);

  if (!task) {
    return;
  }

  if (task.state === 'pending') {
    task.canceled = true;
    removePendingWarmup(task);
    tasksByHref.delete(normalizedHref);
    return;
  }

  task.claimedByNavigation = true;
}

/**
 * Cancels speculative work once the UI signal that justified it disappears.
 *
 * Navigation-claimed work is intentionally immune here because after a click it
 * is no longer speculative. Pending tasks are simply removed from the queue;
 * inflight tasks are aborted through their controller.
 */
export function cancelRouteWarmup(rawHref: string): void {
  pruneExpiredWarmups();

  const normalizedHref = normalizeWarmupHref(rawHref);

  if (!normalizedHref) {
    return;
  }

  const task = tasksByHref.get(normalizedHref);

  if (!task || task.claimedByNavigation) {
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
export function clearRouteWarmupState(): void {
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
  cachedRouteWarmupPolicyState = null;
  pauseSpeculativeWarmupAfterNavigation = false;
  detachSpeculativeWarmupResumeListeners();
  restoreWarmupFetchInterceptor();
  notifyRouteWarmupPolicySubscribers();
}

/**
 * Exposes a small snapshot of internal scheduler state for tests and manual
 * debugging.
 */
export function getRouteWarmupState() {
  const routeWarmupPolicyState = getRouteWarmupPolicyState();

  return {
    activeWarmups,
    disableWarmup: routeWarmupPolicyState.disableWarmup,
    inflightHrefs: Array.from(inflightWarmups),
    pauseSpeculativeWarmup: routeWarmupPolicyState.pauseSpeculativeWarmup,
    pendingHrefs: pendingWarmups.map((task) => task.href),
    recentHrefs: Array.from(recentWarmups.keys()),
  };
}
