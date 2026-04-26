import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SSRPrefetchLink } from 'components/shared/ssr-prefetch-link';
import { requestBookRouteWarmup } from 'common/utils/book-route-prefetch';

vi.mock('common/utils/book-route-prefetch', () => ({
  requestBookRouteWarmup: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: React.forwardRef<
    HTMLAnchorElement,
    React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
  >(function MockLink({ href, children, ...rest }, ref) {
    return (
      <a
        ref={ref}
        href={href}
        {...rest}
        onClick={(event) => {
          rest.onClick?.(event);
          event.preventDefault();
        }}
      >
        {children}
      </a>
    );
  }),
}));

const mockedRequestBookRouteWarmup = vi.mocked(requestBookRouteWarmup);

describe('SSRPrefetchLink component', () => {
  let observeCallback: IntersectionObserverCallback | null = null;
  const observeMock = vi.fn();
  const disconnectMock = vi.fn();
  const originalIntersectionObserver = global.IntersectionObserver;
  const originalMatchMedia = window.matchMedia;

  class MockIntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
      observeCallback = callback;
    }

    observe = observeMock;
    disconnect = disconnectMock;
    takeRecords = vi.fn();
    unobserve = vi.fn();
  }

  function setMatchMedia(matches: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as never;
  }

  beforeEach(() => {
    mockedRequestBookRouteWarmup.mockReset();
    observeCallback = null;
    observeMock.mockClear();
    disconnectMock.mockClear();

    setMatchMedia(false);
    global.IntersectionObserver = MockIntersectionObserver as never;
  });

  afterEach(() => {
    global.IntersectionObserver = originalIntersectionObserver as never;
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  test('warms on hover', () => {
    render(<SSRPrefetchLink href="/books/1~sample-book">Sample Book</SSRPrefetchLink>);

    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Sample Book' }));

    expect(mockedRequestBookRouteWarmup).toHaveBeenCalledWith(
      '/books/1~sample-book',
      'hover'
    );
  });

  test('does not observe viewport warming on desktop', async () => {
    render(<SSRPrefetchLink href="/books/1~sample-book">Sample Book</SSRPrefetchLink>);

    await waitFor(() => {
      expect(observeMock).not.toHaveBeenCalled();
    });
    expect(observeCallback).toBeNull();
  });

  test('warms once when the link enters the viewport on touch devices', async () => {
    setMatchMedia(true);

    render(<SSRPrefetchLink href="/books/1~sample-book">Sample Book</SSRPrefetchLink>);

    await waitFor(() => {
      expect(observeCallback).toBeTruthy();
    });

    await act(async () => {
      observeCallback?.(
        [
          {
            isIntersecting: true,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver
      );
    });

    await waitFor(() => {
      expect(mockedRequestBookRouteWarmup).toHaveBeenCalledWith(
        '/books/1~sample-book',
        'viewport'
      );
    });
  });
});
