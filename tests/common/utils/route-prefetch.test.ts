import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import PageLoader from 'next/dist/client/page-loader';
import { formatWithValidation } from 'next/dist/shared/lib/router/utils/format-url';
import {
  clearRouteWarmupState,
  claimRouteWarmup,
  cancelRouteWarmup,
  getRouteWarmupState,
  pauseSpeculativeRouteWarmupsUntilUserActivity,
  requestRouteWarmup,
} from 'common/utils/route-prefetch';

describe('common/utils/route-prefetch', () => {
  beforeEach(() => {
    clearRouteWarmupState();
    const nextWindow = window as Window & {
      __NEXT_DATA__?: unknown;
      __BUILD_MANIFEST?: { sortedPages?: string[] };
      __DEV_PAGES_MANIFEST?: { pages?: string[] };
    };
    Reflect.deleteProperty(nextWindow, '__NEXT_DATA__');
    Reflect.deleteProperty(nextWindow, '__BUILD_MANIFEST');
    Reflect.deleteProperty(nextWindow, '__DEV_PAGES_MANIFEST');
    Reflect.deleteProperty(navigator, 'connection');
    Reflect.deleteProperty(navigator, 'mozConnection');
    Reflect.deleteProperty(navigator, 'webkitConnection');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');

    nextWindow.__BUILD_MANIFEST = {
      sortedPages: [
        '/',
        '/articles/[slug]',
        '/books',
        '/books/[slug]',
        '/books/[slug]/chapters/[chapterSlug]',
      ],
    };
  });

  afterEach(() => {
    clearRouteWarmupState();
    const nextWindow = window as Window & {
      __NEXT_DATA__?: unknown;
      __BUILD_MANIFEST?: { sortedPages?: string[] };
      __DEV_PAGES_MANIFEST?: { pages?: string[] };
    };
    Reflect.deleteProperty(nextWindow, '__NEXT_DATA__');
    Reflect.deleteProperty(nextWindow, '__BUILD_MANIFEST');
    Reflect.deleteProperty(nextWindow, '__DEV_PAGES_MANIFEST');
    Reflect.deleteProperty(navigator, 'connection');
    Reflect.deleteProperty(navigator, 'mozConnection');
    Reflect.deleteProperty(navigator, 'webkitConnection');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test.each([
    {
      name: 'article route',
      asPath: '/articles/hello-world?from=home',
      href: '/articles/hello-world?from=home',
      pathname: '/articles/[slug]',
      query: {
        slug: 'hello-world',
        from: 'home',
      },
    },
    {
      name: 'book route',
      asPath: '/books/1~sample-book?from=rail',
      href: '/books/1~sample-book?from=rail',
      pathname: '/books/[slug]',
      query: {
        slug: '1~sample-book',
        from: 'rail',
      },
    },
    {
      name: 'chapter route',
      asPath: '/books/1~sample-book/chapters/intro-to-performance?from=toc',
      href: '/books/1~sample-book/chapters/intro-to-performance?from=toc',
      pathname: '/books/[slug]/chapters/[chapterSlug]',
      query: {
        slug: '1~sample-book',
        chapterSlug: 'intro-to-performance',
        from: 'toc',
      },
    },
  ])('matches Next Pages Router data URL generation for $name', async ({
    asPath,
    href,
    pathname,
    query,
  }) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const nextDataWindow = window as unknown as {
      __NEXT_DATA__?: {
        buildId?: string;
      };
      __SSG_MANIFEST?: Set<string>;
    };
    nextDataWindow.__NEXT_DATA__ = {
      buildId: 'test-build',
    };
    nextDataWindow.__SSG_MANIFEST = new Set();

    requestRouteWarmup(href);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const pageLoader = new PageLoader('test-build', '');
    const expectedDataHref = pageLoader.getDataHref({
      asPath,
      href: formatWithValidation({
        pathname,
        query,
      }),
      skipInterpolation: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expectedDataHref,
      expect.objectContaining({
        credentials: 'same-origin',
        headers: expect.objectContaining({
          'x-nextjs-data': '1',
        }),
        method: 'GET',
        signal: expect.any(AbortSignal),
      })
    );

    await Promise.resolve();
  });

  test('warms a canonical internal route once even when requested repeatedly', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    requestRouteWarmup('/books/1~sample-book');
    requestRouteWarmup('/books/1~sample-book');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/books/1~sample-book',
      expect.objectContaining({
        credentials: 'same-origin',
        method: 'GET',
        signal: expect.any(AbortSignal),
      })
    );

    await Promise.resolve();

    expect(getRouteWarmupState().recentHrefs).toContain('/books/1~sample-book');
  });

  test.each([
    {
      connection: {
        effectiveType: '4g',
        saveData: true,
      },
      name: 'Save-Data is enabled',
    },
    {
      connection: {
        effectiveType: '2g',
        saveData: false,
      },
      name: 'effectiveType is 2g',
    },
  ])('skips all warmups when $name', ({ connection }) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: {
        ...connection,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    requestRouteWarmup('/books/1~sample-book', 'hover');
    requestRouteWarmup('/books/2~sample-book', 'pointer');
    requestRouteWarmup('/books/3~sample-book', 'viewport');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getRouteWarmupState().disableWarmup).toBe(true);
  });

  test('pauses speculative warmups after navigation until fresh user activity', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    pauseSpeculativeRouteWarmupsUntilUserActivity();

    expect(getRouteWarmupState().pauseSpeculativeWarmup).toBe(true);

    requestRouteWarmup('/books/1~sample-book', 'viewport');
    requestRouteWarmup('/books/2~sample-book', 'pointer');

    expect(fetchMock).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('scroll'));

    expect(getRouteWarmupState().pauseSpeculativeWarmup).toBe(false);

    requestRouteWarmup('/books/1~sample-book', 'viewport');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/books/1~sample-book',
      expect.objectContaining({
        credentials: 'same-origin',
        method: 'GET',
        signal: expect.any(AbortSignal),
      })
    );
  });

  test('hover intent resumes a paused policy immediately', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    pauseSpeculativeRouteWarmupsUntilUserActivity();

    expect(getRouteWarmupState().pauseSpeculativeWarmup).toBe(true);

    requestRouteWarmup('/books/1~sample-book', 'hover');

    expect(getRouteWarmupState().pauseSpeculativeWarmup).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('builds Next data query params from any matched dynamic route pattern', async () => {
    const deferreds: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          deferreds.push(resolve);
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    const nextDataWindow = window as unknown as {
      __NEXT_DATA__?: {
        buildId?: string;
      };
    };
    nextDataWindow.__NEXT_DATA__ = {
      buildId: 'test-build',
    };

    requestRouteWarmup('/articles/hello-world');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/_next/data/test-build/articles/hello-world.json?slug=hello-world',
      expect.objectContaining({
        credentials: 'same-origin',
        headers: expect.objectContaining({
          'x-nextjs-data': '1',
        }),
        method: 'GET',
        signal: expect.any(AbortSignal),
      })
    );

    deferreds[0]?.(new Response('ok', { status: 200 }));

    const response = await fetch(
      '/_next/data/test-build/articles/hello-world.json?slug=hello-world',
      {
        credentials: 'same-origin',
        headers: {
          'x-nextjs-data': '1',
        },
        method: 'GET',
      }
    );

    expect(await response.text()).toBe('ok');
  });

  test('reuses the in-flight Next data request for a clicked book route', async () => {
    const deferreds: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          deferreds.push(resolve);
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    const nextDataWindow = window as unknown as {
      __NEXT_DATA__?: {
        buildId?: string;
      };
    };
    nextDataWindow.__NEXT_DATA__ = {
      buildId: 'test-build',
    };

    requestRouteWarmup('/books/1~sample-book');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/_next/data/test-build/books/1~sample-book.json?slug=1%7Esample-book',
      expect.objectContaining({
        credentials: 'same-origin',
        headers: expect.objectContaining({
          'x-nextjs-data': '1',
        }),
        method: 'GET',
        signal: expect.any(AbortSignal),
      })
    );

    const sharedFetch = fetch(
      '/_next/data/test-build/books/1~sample-book.json?slug=1%7Esample-book',
      {
        credentials: 'same-origin',
        headers: {
          'x-nextjs-data': '1',
        },
        method: 'GET',
      }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    deferreds[0]?.(new Response('ok', { status: 200 }));

    const response = await sharedFetch;

    expect(await response.text()).toBe('ok');
  });

  test('reuses a completed warmup for a later book navigation request', async () => {
    const deferreds: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          deferreds.push(resolve);
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    const nextDataWindow = window as unknown as {
      __NEXT_DATA__?: {
        buildId?: string;
      };
    };
    nextDataWindow.__NEXT_DATA__ = {
      buildId: 'test-build',
    };

    requestRouteWarmup('/books/1~sample-book');

    expect(fetchMock).toHaveBeenCalledTimes(1);

    deferreds[0]?.(new Response('ok', { status: 200 }));

    await waitFor(() => {
      expect(getRouteWarmupState().recentHrefs).toContain(
        '/books/1~sample-book'
      );
    });

    const sharedFetch = fetch(
      '/_next/data/test-build/books/1~sample-book.json?slug=1%7Esample-book',
      {
        credentials: 'same-origin',
        headers: {
          'x-nextjs-data': '1',
        },
        method: 'GET',
      }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const response = await sharedFetch;

    expect(await response.text()).toBe('ok');
  });

  test('keeps sharing working after the owner response body has already been read', async () => {
    const deferreds: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          deferreds.push(resolve);
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    const nextDataWindow = window as unknown as {
      __NEXT_DATA__?: {
        buildId?: string;
      };
    };
    nextDataWindow.__NEXT_DATA__ = {
      buildId: 'test-build',
    };

    requestRouteWarmup('/books/seed~sample-book');

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const ownerFetch = fetch(
      '/_next/data/test-build/books/2~sample-book.json?slug=2%7Esample-book',
      {
        credentials: 'same-origin',
        headers: {
          'x-nextjs-data': '1',
        },
        method: 'GET',
      }
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);

    deferreds[1]?.(new Response('ok', { status: 200 }));
    deferreds[0]?.(new Response('seed', { status: 200 }));

    const ownerResponse = await ownerFetch;
    expect(await ownerResponse.text()).toBe('ok');

    const sharedFetch = fetch(
      '/_next/data/test-build/books/2~sample-book.json?slug=2%7Esample-book',
      {
        credentials: 'same-origin',
        headers: {
          'x-nextjs-data': '1',
        },
        method: 'GET',
      }
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const sharedResponse = await sharedFetch;
    expect(await sharedResponse.text()).toBe('ok');
  });

  test('shares matching book-route data fetches even when they start outside the scheduler', async () => {
    const deferreds: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          deferreds.push(resolve);
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    const nextDataWindow = window as unknown as {
      __NEXT_DATA__?: {
        buildId?: string;
      };
    };
    nextDataWindow.__NEXT_DATA__ = {
      buildId: 'test-build',
    };

    requestRouteWarmup('/books/seed~sample-book');

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const sharedFetchA = fetch(
      '/_next/data/test-build/books/2~sample-book.json?slug=2%7Esample-book',
      {
        credentials: 'same-origin',
        headers: {
          'x-nextjs-data': '1',
        },
        method: 'GET',
      }
    );
    const sharedFetchB = fetch(
      '/_next/data/test-build/books/2~sample-book.json?slug=2%7Esample-book',
      {
        credentials: 'same-origin',
        headers: {
          'x-nextjs-data': '1',
        },
        method: 'GET',
      }
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);

    deferreds[1]?.(new Response('ok', { status: 200 }));
    deferreds[0]?.(new Response('seed', { status: 200 }));

    const [responseA, responseB] = await Promise.all([sharedFetchA, sharedFetchB]);

    expect(await responseA.text()).toBe('ok');
    expect(await responseB.text()).toBe('ok');
  });

  test('reuses the in-flight Next data request for a clicked chapter route', async () => {
    const deferreds: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          deferreds.push(resolve);
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    const nextDataWindow = window as unknown as {
      __NEXT_DATA__?: {
        buildId?: string;
      };
    };
    nextDataWindow.__NEXT_DATA__ = {
      buildId: 'test-build',
    };

    requestRouteWarmup('/books/1~sample-book/chapters/intro-to-performance');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/_next/data/test-build/books/1~sample-book/chapters/intro-to-performance.json?slug=1%7Esample-book&chapterSlug=intro-to-performance',
      expect.objectContaining({
        credentials: 'same-origin',
        headers: expect.objectContaining({
          'x-nextjs-data': '1',
        }),
        method: 'GET',
        signal: expect.any(AbortSignal),
      })
    );

    const sharedFetch = fetch(
      '/_next/data/test-build/books/1~sample-book/chapters/intro-to-performance.json?slug=1%7Esample-book&chapterSlug=intro-to-performance',
      {
        credentials: 'same-origin',
        headers: {
          'x-nextjs-data': '1',
        },
        method: 'GET',
      }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    deferreds[0]?.(new Response('ok', { status: 200 }));

    const response = await sharedFetch;

    expect(await response.text()).toBe('ok');
  });

  test('limits concurrent warmups with a small pool', async () => {
    const deferreds: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          deferreds.push(resolve);
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    requestRouteWarmup('/books/1~sample-book');
    requestRouteWarmup('/books/2~sample-book');
    requestRouteWarmup('/books/3~sample-book');

    expect(fetchMock).toHaveBeenCalledTimes(2);

    deferreds[0]?.(new Response('ok', { status: 200 }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    deferreds[1]?.(new Response('ok', { status: 200 }));
    deferreds[2]?.(new Response('ok', { status: 200 }));
    await Promise.resolve();
  });

  test('prioritizes pointer warmups over viewport warmups', async () => {
    const deferreds: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          deferreds.push(resolve);
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    requestRouteWarmup('/books/1~sample-book', 'viewport');
    requestRouteWarmup('/books/2~sample-book', 'viewport');
    requestRouteWarmup('/books/3~sample-book', 'pointer');
    requestRouteWarmup('/books/4~sample-book', 'viewport');

    expect(fetchMock).toHaveBeenCalledTimes(2);

    deferreds[0]?.(new Response('ok', { status: 200 }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    const thirdCall = fetchMock.mock.calls[2] as unknown as
      | [string, RequestInit?]
      | undefined;

    expect(thirdCall?.[0]).toBe('/books/3~sample-book');
  });

  test('cancels a pending warmup before it starts', async () => {
    const deferreds: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          deferreds.push(resolve);
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    requestRouteWarmup('/books/1~sample-book', 'viewport');
    requestRouteWarmup('/books/2~sample-book', 'viewport');
    requestRouteWarmup('/books/3~sample-book', 'viewport');

    expect(fetchMock).toHaveBeenCalledTimes(2);

    cancelRouteWarmup('/books/3~sample-book');
    deferreds[0]?.(new Response('ok', { status: 200 }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(getRouteWarmupState().pendingHrefs).not.toContain(
        '/books/3~sample-book'
      );
    });
  });

  test('aborts an inflight warmup when it is canceled', async () => {
    const abortSignals: AbortSignal[] = [];
    const fetchMock = vi.fn(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;

          if (signal) {
            abortSignals.push(signal);
            signal.addEventListener(
              'abort',
              () => {
                reject(new DOMException('Aborted', 'AbortError'));
              },
              { once: true }
            );
          }
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    requestRouteWarmup('/books/1~sample-book', 'viewport');

    expect(fetchMock).toHaveBeenCalledTimes(1);

    cancelRouteWarmup('/books/1~sample-book');

    expect(abortSignals[0]?.aborted).toBe(true);

    await waitFor(() => {
      expect(getRouteWarmupState().activeWarmups).toBe(0);
      expect(getRouteWarmupState().inflightHrefs).toHaveLength(0);
    });
  });

  test('promotes an inflight warmup on click so cleanup does not abort it', async () => {
    const abortSignals: AbortSignal[] = [];
    const fetchMock = vi.fn(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;

          if (signal) {
            abortSignals.push(signal);
            signal.addEventListener(
              'abort',
              () => {
                reject(new DOMException('Aborted', 'AbortError'));
              },
              { once: true }
            );
          }
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    requestRouteWarmup('/books/1~sample-book', 'viewport');

    expect(fetchMock).toHaveBeenCalledTimes(1);

    claimRouteWarmup('/books/1~sample-book');
    cancelRouteWarmup('/books/1~sample-book');

    expect(abortSignals[0]?.aborted).toBe(false);
    expect(getRouteWarmupState().inflightHrefs).toContain(
      '/books/1~sample-book'
    );
  });

  test('aborts an inflight hover warmup when it is not claimed by navigation', async () => {
    const abortSignals: AbortSignal[] = [];
    const fetchMock = vi.fn(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;

          if (signal) {
            abortSignals.push(signal);
            signal.addEventListener(
              'abort',
              () => {
                reject(new DOMException('Aborted', 'AbortError'));
              },
              { once: true }
            );
          }
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    requestRouteWarmup('/books/1~sample-book', 'hover');

    expect(fetchMock).toHaveBeenCalledTimes(1);

    cancelRouteWarmup('/books/1~sample-book');

    expect(abortSignals[0]?.aborted).toBe(true);

    await waitFor(() => {
      expect(getRouteWarmupState().activeWarmups).toBe(0);
      expect(getRouteWarmupState().inflightHrefs).toHaveLength(0);
    });
  });

  test('drops a pending hover warmup on click so it cannot start after navigation', async () => {
    const deferreds: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          deferreds.push(resolve);
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    requestRouteWarmup('/books/1~sample-book', 'viewport');
    requestRouteWarmup('/books/2~sample-book', 'viewport');
    requestRouteWarmup('/books/3~sample-book', 'hover');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getRouteWarmupState().pendingHrefs).toContain(
      '/books/3~sample-book'
    );

    claimRouteWarmup('/books/3~sample-book');

    expect(getRouteWarmupState().pendingHrefs).not.toContain(
      '/books/3~sample-book'
    );

    deferreds[0]?.(new Response('ok', { status: 200 }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  test('drops a pending warmup on click so it cannot start after navigation', async () => {
    const deferreds: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          deferreds.push(resolve);
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    requestRouteWarmup('/books/1~sample-book', 'viewport');
    requestRouteWarmup('/books/2~sample-book', 'viewport');
    requestRouteWarmup('/books/3~sample-book', 'viewport');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getRouteWarmupState().pendingHrefs).toContain(
      '/books/3~sample-book'
    );

    claimRouteWarmup('/books/3~sample-book');

    expect(getRouteWarmupState().pendingHrefs).not.toContain(
      '/books/3~sample-book'
    );

    deferreds[0]?.(new Response('ok', { status: 200 }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  test('prioritizes the most recently scheduled viewport warmup once a slot opens', async () => {
    const deferreds: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          deferreds.push(resolve);
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    requestRouteWarmup('/books/1~sample-book', 'viewport');
    requestRouteWarmup('/books/2~sample-book', 'viewport');
    requestRouteWarmup('/books/3~sample-book', 'viewport');
    requestRouteWarmup('/books/4~sample-book', 'viewport');
    requestRouteWarmup('/books/5~sample-book', 'viewport');

    expect(fetchMock).toHaveBeenCalledTimes(2);

    deferreds[0]?.(new Response('ok', { status: 200 }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    const thirdCall = fetchMock.mock.calls[2] as unknown as
      | [string, RequestInit?]
      | undefined;

    expect(thirdCall?.[0]).toBe('/books/5~sample-book');
  });

  test('re-enqueues a route cleanly after queue trimming drops its old pending task', () => {
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>(() => {
          // Keep the concurrency pool full so the queue state stays observable.
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    for (let index = 1; index <= 35; index += 1) {
      requestRouteWarmup(`/books/${index}~sample-book`, 'viewport');
    }

    expect(getRouteWarmupState().pendingHrefs).not.toContain('/books/3~sample-book');

    requestRouteWarmup('/books/3~sample-book', 'viewport');

    expect(getRouteWarmupState().pendingHrefs).toContain('/books/3~sample-book');
  });

  test('skips external urls and the current page', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/books/1~sample-book');

    requestRouteWarmup('https://example.com/books/1~sample-book');
    requestRouteWarmup('/books/1~sample-book');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
