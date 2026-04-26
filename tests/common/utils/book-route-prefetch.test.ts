import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import {
  clearBookRouteWarmupState,
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
    expect(fetchMock).toHaveBeenCalledWith('/books/1~sample-book', {
      credentials: 'same-origin',
      method: 'GET',
    });

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

  test('skips external urls and the current page', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/books/1~sample-book');

    requestBookRouteWarmup('https://example.com/books/1~sample-book');
    requestBookRouteWarmup('/books/1~sample-book');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
