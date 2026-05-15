import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ScrollRestoration } from '@/components/core/effects/scroll-restoration';

const navigationState = vi.hoisted(() => ({
  pathname: '/',
  search: '',
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigationState.pathname,
  useSearchParams: () => ({
    toString: () => navigationState.search,
  }),
}));

function setScrollPosition(x: number, y: number) {
  Object.defineProperty(window, 'scrollX', {
    value: x,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, 'scrollY', {
    value: y,
    writable: true,
    configurable: true,
  });
}

function setDocumentHeight(height: number) {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: height,
    configurable: true,
  });
  Object.defineProperty(document.body, 'scrollHeight', {
    value: height,
    configurable: true,
  });
}

function readStoredPosition(url: string) {
  const value = window.sessionStorage.getItem(`scroll-pos:${url}`);

  return value ? (JSON.parse(value) as { x: number; y: number }) : null;
}

describe('ScrollRestoration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    navigationState.pathname = '/';
    navigationState.search = '';
    window.history.replaceState({}, '', '/');
    window.sessionStorage.clear();
    setScrollPosition(0, 0);
    setDocumentHeight(2400);
    Object.defineProperty(window, 'innerHeight', {
      value: 600,
      writable: true,
      configurable: true,
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      return window.setTimeout(() => callback(performance.now()), 0);
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => {
      window.clearTimeout(handle);
    });
    vi.spyOn(window, 'scrollTo').mockImplementation(((
      optionsOrX: number | ScrollToOptions,
      y?: number
    ) => {
      if (typeof optionsOrX === 'number') {
        setScrollPosition(optionsOrX, y ?? 0);
        return;
      }

      setScrollPosition(
        typeof optionsOrX.left === 'number' ? optionsOrX.left : window.scrollX,
        typeof optionsOrX.top === 'number' ? optionsOrX.top : window.scrollY
      );
    }) as typeof window.scrollTo);
  });

  test('continuously saves the current route scroll position', async () => {
    render(<ScrollRestoration />);

    act(() => {
      setScrollPosition(0, 420);
      window.dispatchEvent(new Event('scroll'));
    });

    await waitFor(() => {
      expect(readStoredPosition('/')).toEqual({ x: 0, y: 420 });
    });
  });

  test('saves before link navigation when the anchor is the click target', () => {
    render(<ScrollRestoration />);

    const link = document.createElement('a');
    link.href = '/posts/example';
    link.addEventListener('click', (event) => event.preventDefault());
    document.body.append(link);

    act(() => {
      setScrollPosition(0, 510);
      fireEvent.click(link);
    });

    expect(readStoredPosition('/')).toEqual({ x: 0, y: 510 });
  });

  test('does not overwrite the leaving route with transition scroll events', async () => {
    render(<ScrollRestoration />);

    const link = document.createElement('a');
    link.href = '/posts/example';
    link.addEventListener('click', (event) => event.preventDefault());
    document.body.append(link);

    act(() => {
      setScrollPosition(0, 640);
      fireEvent.click(link);
      setScrollPosition(0, 0);
      window.dispatchEvent(new Event('scroll'));
    });

    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(readStoredPosition('/')).toEqual({ x: 0, y: 640 });
  });

  test('restores the destination route after browser back navigation', async () => {
    navigationState.pathname = '/posts/example';
    window.history.replaceState({}, '', '/posts/example');
    window.sessionStorage.setItem(
      'scroll-pos:/',
      JSON.stringify({ x: 0, y: 760 })
    );
    const { rerender } = render(<ScrollRestoration />);

    act(() => {
      setScrollPosition(0, 20);
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    navigationState.pathname = '/';
    rerender(<ScrollRestoration />);

    await waitFor(() => {
      expect(window.scrollY).toBe(760);
      expect(window.__historyScrollRestoredFor).toBe('/');
    });
  });

  test('waits for first-visit page height before restoring', async () => {
    navigationState.pathname = '/posts/example';
    window.history.replaceState({}, '', '/posts/example');
    window.sessionStorage.setItem(
      'scroll-pos:/',
      JSON.stringify({ x: 0, y: 1200 })
    );
    setDocumentHeight(900);
    const { rerender } = render(<ScrollRestoration />);

    act(() => {
      setScrollPosition(0, 20);
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    navigationState.pathname = '/';
    rerender(<ScrollRestoration />);

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(window.scrollY).toBe(20);

    act(() => {
      setDocumentHeight(2400);
    });

    await waitFor(() => {
      expect(window.scrollY).toBe(1200);
    });
  });

  test('restores when the route hook updates before popstate is handled', async () => {
    navigationState.pathname = '/posts/example';
    window.history.replaceState({}, '', '/posts/example');
    window.sessionStorage.setItem(
      'scroll-pos:/',
      JSON.stringify({ x: 0, y: 900 })
    );
    const { rerender } = render(<ScrollRestoration />);

    navigationState.pathname = '/';
    rerender(<ScrollRestoration />);

    act(() => {
      setScrollPosition(0, 20);
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await waitFor(() => {
      expect(window.scrollY).toBe(900);
    });
  });
});
