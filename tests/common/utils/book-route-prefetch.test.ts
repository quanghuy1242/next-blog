import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import {
  clearBookRouteWarmupState,
  claimBookRouteWarmup,
  cancelBookRouteWarmup,
  getBookRouteWarmupState,
  requestBookRouteWarmup,
} from 'common/utils/book-route-prefetch';

describe('common/utils/book-route-prefetch', () => {
  beforeEach(() => {
    clearBookRouteWarmupState();
    Reflect.deleteProperty(window as Window & { __NEXT_DATA__?: unknown }, '__NEXT_DATA__');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    clearBookRouteWarmupState();
    Reflect.deleteProperty(window as Window & { __NEXT_DATA__?: unknown }, '__NEXT_DATA__');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('warms a canonical internal route once even when requested repeatedly', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    requestBookRouteWarmup('/books/1~sample-book');
    requestBookRouteWarmup('/books/1~sample-book');

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

    expect(getBookRouteWarmupState().recentHrefs).toContain('/books/1~sample-book');
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

    requestBookRouteWarmup('/books/1~sample-book');

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

    requestBookRouteWarmup('/books/1~sample-book');

    expect(fetchMock).toHaveBeenCalledTimes(1);

    deferreds[0]?.(new Response('ok', { status: 200 }));

    await waitFor(() => {
      expect(getBookRouteWarmupState().recentHrefs).toContain(
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

    requestBookRouteWarmup('/books/seed~sample-book');

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

    requestBookRouteWarmup('/books/seed~sample-book');

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

    requestBookRouteWarmup('/books/1~sample-book/chapters/intro-to-performance');

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

    requestBookRouteWarmup('/books/1~sample-book');
    requestBookRouteWarmup('/books/2~sample-book');
    requestBookRouteWarmup('/books/3~sample-book');

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

    requestBookRouteWarmup('/books/1~sample-book', 'viewport');
    requestBookRouteWarmup('/books/2~sample-book', 'viewport');
    requestBookRouteWarmup('/books/3~sample-book', 'pointer');
    requestBookRouteWarmup('/books/4~sample-book', 'viewport');

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

    requestBookRouteWarmup('/books/1~sample-book', 'viewport');
    requestBookRouteWarmup('/books/2~sample-book', 'viewport');
    requestBookRouteWarmup('/books/3~sample-book', 'viewport');

    expect(fetchMock).toHaveBeenCalledTimes(2);

    cancelBookRouteWarmup('/books/3~sample-book');
    deferreds[0]?.(new Response('ok', { status: 200 }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(getBookRouteWarmupState().pendingHrefs).not.toContain(
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

    requestBookRouteWarmup('/books/1~sample-book', 'viewport');

    expect(fetchMock).toHaveBeenCalledTimes(1);

    cancelBookRouteWarmup('/books/1~sample-book');

    expect(abortSignals[0]?.aborted).toBe(true);

    await waitFor(() => {
      expect(getBookRouteWarmupState().activeWarmups).toBe(0);
      expect(getBookRouteWarmupState().inflightHrefs).toHaveLength(0);
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

    requestBookRouteWarmup('/books/1~sample-book', 'viewport');

    expect(fetchMock).toHaveBeenCalledTimes(1);

    claimBookRouteWarmup('/books/1~sample-book');
    cancelBookRouteWarmup('/books/1~sample-book');

    expect(abortSignals[0]?.aborted).toBe(false);
    expect(getBookRouteWarmupState().inflightHrefs).toContain(
      '/books/1~sample-book'
    );
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

    requestBookRouteWarmup('/books/1~sample-book', 'viewport');
    requestBookRouteWarmup('/books/2~sample-book', 'viewport');
    requestBookRouteWarmup('/books/3~sample-book', 'viewport');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getBookRouteWarmupState().pendingHrefs).toContain(
      '/books/3~sample-book'
    );

    claimBookRouteWarmup('/books/3~sample-book');

    expect(getBookRouteWarmupState().pendingHrefs).not.toContain(
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

    requestBookRouteWarmup('/books/1~sample-book', 'viewport');
    requestBookRouteWarmup('/books/2~sample-book', 'viewport');
    requestBookRouteWarmup('/books/3~sample-book', 'viewport');
    requestBookRouteWarmup('/books/4~sample-book', 'viewport');
    requestBookRouteWarmup('/books/5~sample-book', 'viewport');

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

  test('skips external urls and the current page', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/books/1~sample-book');

    requestBookRouteWarmup('https://example.com/books/1~sample-book');
    requestBookRouteWarmup('/books/1~sample-book');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
