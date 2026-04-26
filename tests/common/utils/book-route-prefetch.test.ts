import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import {
  clearBookRouteWarmupState,
  cancelBookRouteWarmup,
  getBookRouteWarmupState,
  requestBookRouteWarmup,
} from 'common/utils/book-route-prefetch';

describe('common/utils/book-route-prefetch', () => {
  beforeEach(() => {
    clearBookRouteWarmupState();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    clearBookRouteWarmupState();
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
