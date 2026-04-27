import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SSRPrefetchLink } from 'components/shared/ssr-prefetch-link';
import {
  claimRouteWarmup,
  cancelRouteWarmup,
  getRouteWarmupPolicyState,
  isSameWarmupHref,
  pauseSpeculativeRouteWarmupsUntilUserActivity,
  requestRouteWarmup,
  subscribeRouteWarmupPolicy,
} from 'common/utils/route-prefetch';

const TOUCH_DEVICE_QUERY = '(hover: none), (pointer: coarse)';
const DESKTOP_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

vi.mock('common/utils/route-prefetch', () => ({
  claimRouteWarmup: vi.fn(),
  cancelRouteWarmup: vi.fn(),
  getRouteWarmupPolicyState: vi.fn(() => ({
    allowHoverWarmup: true,
    allowPointerWarmup: true,
    allowViewportWarmup: true,
    disableWarmup: false,
    pauseSpeculativeWarmup: false,
  })),
  isSameWarmupHref: vi.fn(() => false),
  pauseSpeculativeRouteWarmupsUntilUserActivity: vi.fn(),
  requestRouteWarmup: vi.fn(),
  subscribeRouteWarmupPolicy: vi.fn(() => () => {}),
}));

vi.mock('next/link', () => ({
  default: React.forwardRef<
    HTMLAnchorElement,
    React.AnchorHTMLAttributes<HTMLAnchorElement> & {
      href: string;
      onNavigate?: (event: { preventDefault: () => void }) => void;
    }
  >(function MockLink({ href, children, ...rest }, ref) {
    return (
      <a
        ref={ref}
        href={href}
        {...rest}
        onClick={(event) => {
          rest.onClick?.(event);

          if (event.defaultPrevented) {
            return;
          }

          if (
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            event.button === 1
          ) {
            return;
          }

          let navigatePrevented = false;
          rest.onNavigate?.({
            preventDefault: () => {
              navigatePrevented = true;
            },
          });

          if (navigatePrevented) {
            return;
          }

          event.preventDefault();
        }}
      >
        {children}
      </a>
    );
  }),
}));

const mockedRequestRouteWarmup = vi.mocked(requestRouteWarmup);
const mockedClaimRouteWarmup = vi.mocked(claimRouteWarmup);
const mockedCancelRouteWarmup = vi.mocked(cancelRouteWarmup);
const mockedGetRouteWarmupPolicyState = vi.mocked(getRouteWarmupPolicyState);
const mockedIsSameWarmupHref = vi.mocked(isSameWarmupHref);
const mockedPauseSpeculativeRouteWarmupsUntilUserActivity = vi.mocked(
  pauseSpeculativeRouteWarmupsUntilUserActivity
);
const mockedSubscribeRouteWarmupPolicy = vi.mocked(subscribeRouteWarmupPolicy);

describe('SSRPrefetchLink component', () => {
  let observeCallback: IntersectionObserverCallback | null = null;
  const observeMock = vi.fn();
  const disconnectMock = vi.fn();
  const originalIntersectionObserver = global.IntersectionObserver;
  const originalMatchMedia = window.matchMedia;
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;

  class MockIntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
      observeCallback = callback;
    }

    observe = observeMock;
    disconnect = disconnectMock;
    takeRecords = vi.fn();
    unobserve = vi.fn();
  }

  function setMatchMedia(matches: boolean | ((query: string) => boolean)) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: typeof matches === 'function' ? matches(query) : matches,
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
    mockedRequestRouteWarmup.mockReset();
    mockedClaimRouteWarmup.mockReset();
    mockedCancelRouteWarmup.mockReset();
    mockedPauseSpeculativeRouteWarmupsUntilUserActivity.mockReset();
    mockedIsSameWarmupHref.mockReset();
    mockedSubscribeRouteWarmupPolicy.mockReset();
    mockedSubscribeRouteWarmupPolicy.mockReturnValue(() => {});
    mockedGetRouteWarmupPolicyState.mockReset();
    mockedGetRouteWarmupPolicyState.mockReturnValue({
      allowHoverWarmup: true,
      allowPointerWarmup: true,
      allowViewportWarmup: true,
      disableWarmup: false,
      pauseSpeculativeWarmup: false,
    });
    mockedIsSameWarmupHref.mockReturnValue(false);
    observeCallback = null;
    observeMock.mockClear();
    disconnectMock.mockClear();
    window.requestAnimationFrame = vi
      .fn((callback: FrameRequestCallback) => {
        const timeoutId = window.setTimeout(() => {
          callback(0);
        }, 0);
        return timeoutId as unknown as number;
      }) as never;
    window.cancelAnimationFrame = vi.fn((timeoutId: number) => {
      window.clearTimeout(timeoutId);
    }) as never;

    setMatchMedia(() => false);
    global.IntersectionObserver = MockIntersectionObserver as never;
  });

  afterEach(() => {
    global.IntersectionObserver = originalIntersectionObserver as never;
    window.matchMedia = originalMatchMedia;
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    vi.restoreAllMocks();
  });

  test('warms on hover', () => {
    render(<SSRPrefetchLink href="/books/1~sample-book">Sample Book</SSRPrefetchLink>);

    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Sample Book' }));

    expect(mockedRequestRouteWarmup).toHaveBeenCalledWith(
      '/books/1~sample-book',
      'hover'
    );
  });

  test('cancels an unclaimed hover warmup on mouse leave', () => {
    render(<SSRPrefetchLink href="/books/1~sample-book">Sample Book</SSRPrefetchLink>);

    const link = screen.getByRole('link', { name: 'Sample Book' });

    fireEvent.mouseEnter(link);
    fireEvent.mouseLeave(link);

    expect(mockedCancelRouteWarmup).toHaveBeenCalledWith('/books/1~sample-book');
  });

  test('cancels an unclaimed focus warmup on blur', () => {
    render(<SSRPrefetchLink href="/books/1~sample-book">Sample Book</SSRPrefetchLink>);

    const link = screen.getByRole('link', { name: 'Sample Book' });

    fireEvent.focus(link);
    fireEvent.blur(link);

    expect(mockedCancelRouteWarmup).toHaveBeenCalledWith('/books/1~sample-book');
  });

  test('claims an existing warmup on click', () => {
    const onClick = vi.fn();

    render(
      <SSRPrefetchLink href="/books/1~sample-book" onClick={onClick}>
        Sample Book
      </SSRPrefetchLink>
    );

    fireEvent.click(screen.getByRole('link', { name: 'Sample Book' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(mockedClaimRouteWarmup).toHaveBeenCalledWith(
      '/books/1~sample-book'
    );
    expect(mockedPauseSpeculativeRouteWarmupsUntilUserActivity).toHaveBeenCalledTimes(
      1
    );
  });

  test('does not pause speculation when a same-route link is clicked', () => {
    window.history.pushState({}, '', '/books/1~sample-book');
    mockedIsSameWarmupHref.mockReturnValue(true);

    render(
      <SSRPrefetchLink href="/books/1~sample-book">Sample Book</SSRPrefetchLink>
    );

    fireEvent.click(screen.getByRole('link', { name: 'Sample Book' }));

    expect(mockedClaimRouteWarmup).not.toHaveBeenCalled();
    expect(
      mockedPauseSpeculativeRouteWarmupsUntilUserActivity
    ).not.toHaveBeenCalled();
  });

  test('does not claim on a modified click', () => {
    render(<SSRPrefetchLink href="/books/1~sample-book">Sample Book</SSRPrefetchLink>);

    fireEvent.click(screen.getByRole('link', { name: 'Sample Book' }), {
      ctrlKey: true,
    });

    expect(mockedClaimRouteWarmup).not.toHaveBeenCalled();
    expect(
      mockedPauseSpeculativeRouteWarmupsUntilUserActivity
    ).not.toHaveBeenCalled();
  });

  test('does not pause speculation when navigation is prevented', () => {
    render(
      <SSRPrefetchLink
        href="/books/1~sample-book"
        onNavigate={(event) => {
          event.preventDefault();
        }}
      >
        Sample Book
      </SSRPrefetchLink>
    );

    fireEvent.click(screen.getByRole('link', { name: 'Sample Book' }));

    expect(mockedClaimRouteWarmup).not.toHaveBeenCalled();
    expect(
      mockedPauseSpeculativeRouteWarmupsUntilUserActivity
    ).not.toHaveBeenCalled();
  });

  test('does not observe viewport warming on desktop', async () => {
    render(<SSRPrefetchLink href="/books/1~sample-book">Sample Book</SSRPrefetchLink>);

    await waitFor(() => {
      expect(observeMock).not.toHaveBeenCalled();
    });
    expect(observeCallback).toBeNull();
  });

  test('warms once when the link enters the viewport on touch devices', async () => {
    setMatchMedia((query) => query === TOUCH_DEVICE_QUERY);

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
      expect(mockedRequestRouteWarmup).toHaveBeenCalledWith(
        '/books/1~sample-book',
        'viewport'
      );
    });
  });

  test('does not warm speculatively when policy disables viewport warming', async () => {
    setMatchMedia((query) => query === TOUCH_DEVICE_QUERY);
    mockedGetRouteWarmupPolicyState.mockReturnValue({
      allowHoverWarmup: false,
      allowPointerWarmup: false,
      allowViewportWarmup: false,
      disableWarmup: true,
      pauseSpeculativeWarmup: false,
    });

    render(<SSRPrefetchLink href="/books/1~sample-book">Sample Book</SSRPrefetchLink>);

    await waitFor(() => {
      expect(observeMock).not.toHaveBeenCalled();
    });
    expect(observeCallback).toBeNull();
  });

  test('cancels viewport warming when the link leaves the viewport on touch devices', async () => {
    setMatchMedia((query) => query === TOUCH_DEVICE_QUERY);

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

    await act(async () => {
      observeCallback?.(
        [
          {
            isIntersecting: false,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver
      );
    });

    await waitFor(() => {
      expect(mockedCancelRouteWarmup).toHaveBeenCalledWith(
        '/books/1~sample-book'
      );
    });
  });

  test('warms and cancels pointer proximity warming on desktop', async () => {
    setMatchMedia((query) => query === DESKTOP_POINTER_QUERY);
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    render(<SSRPrefetchLink href="/books/1~sample-book">Sample Book</SSRPrefetchLink>);

    const link = screen.getByRole('link', { name: 'Sample Book' });
    Object.defineProperty(link, 'getBoundingClientRect', {
      configurable: true,
      value: () =>
        ({
          bottom: 160,
          height: 80,
          left: 40,
          right: 260,
          top: 80,
          width: 220,
          x: 40,
          y: 80,
          toJSON: () => ({}),
        }) as DOMRect,
    });

    await waitFor(() => {
      expect(window.requestAnimationFrame).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(
        addEventListenerSpy.mock.calls.some(([type]) => type === 'pointermove')
      ).toBe(true);
    });

    const pointerMoveHandler = addEventListenerSpy.mock.calls.find(
      ([type]) => type === 'pointermove'
    )?.[1] as ((event: PointerEvent) => void) | undefined;

    await act(async () => {
      pointerMoveHandler?.({
        clientX: 120,
        clientY: 110,
        pointerType: 'mouse',
      } as PointerEvent);
    });

    await waitFor(() => {
      expect(mockedRequestRouteWarmup).toHaveBeenCalledWith(
        '/books/1~sample-book',
        'pointer'
      );
    });

    await act(async () => {
      pointerMoveHandler?.({
        clientX: 1000,
        clientY: 1000,
        pointerType: 'mouse',
      } as PointerEvent);
    });

    await waitFor(() => {
      expect(mockedCancelRouteWarmup).toHaveBeenCalledWith(
        '/books/1~sample-book'
      );
    });
  });
});
