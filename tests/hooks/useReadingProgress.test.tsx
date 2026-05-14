import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useReadingProgress } from '@/hooks/useReadingProgress';

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', {
    value,
    writable: true,
    configurable: true,
  });
}

function createTargetRef(height: number, topOffset: number) {
  const element = document.createElement('div');

  Object.defineProperty(element, 'scrollHeight', {
    value: height,
    configurable: true,
  });

  element.getBoundingClientRect = vi.fn(() => ({
    x: 0,
    y: topOffset - window.scrollY,
    top: topOffset - window.scrollY,
    bottom: topOffset - window.scrollY + height,
    left: 0,
    right: 0,
    width: 800,
    height,
    toJSON: () => ({}),
  }));

  return { current: element };
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

describe('useReadingProgress', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'innerHeight', {
      value: 600,
      writable: true,
      configurable: true,
    });
    setDocumentHeight(2400);
    setScrollY(0);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
    } as Response);
    window.localStorage.clear();
    window.__historyScrollRestoredFor = undefined;
  });

  test('tracks progress from the chapter content element and does not save on mount', async () => {
    const targetRef = createTargetRef(1600, 200);

    const { result } = renderHook(() =>
      useReadingProgress({
        chapterId: 10,
        bookId: 20,
        enabled: true,
        targetRef,
      })
    );

    expect(result.current).toBe(25);
    expect(global.fetch).not.toHaveBeenCalled();

    act(() => {
      setScrollY(400);
      window.dispatchEvent(new Event('scroll'));
    });

    await waitFor(() => {
      expect(result.current).toBe(50);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/reading-progress',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ chapterId: 10, bookId: 20, progress: 50 }),
      })
    );
  });

  test('flushes the latest chapter progress on pagehide', async () => {
    const targetRef = createTargetRef(1600, 200);

    const { result } = renderHook(() =>
      useReadingProgress({
        chapterId: 10,
        bookId: 20,
        enabled: true,
        targetRef,
      })
    );

    act(() => {
      setScrollY(400);
      window.dispatchEvent(new Event('scroll'));
    });

    await waitFor(() => {
      expect(result.current).toBe(50);
    });

    act(() => {
      setScrollY(1200);
      window.dispatchEvent(new Event('scroll'));
    });

    await waitFor(() => {
      expect(result.current).toBe(100);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/reading-progress',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ chapterId: 10, bookId: 20, progress: 100 }),
      })
    );
  });

  test('restores saved local reading position for the chapter', async () => {
    const targetRef = createTargetRef(1600, 200);
    const scrollToSpy = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation((x: number | ScrollToOptions, y?: number) => {
        if (typeof x === 'number') {
          setScrollY(y ?? 0);
          return;
        }

        setScrollY(typeof x.top === 'number' ? x.top : 0);
      });

    window.localStorage.setItem(
      'reading-position:20:10',
      JSON.stringify({ progress: 35, scrollY: 160 })
    );

    const { result } = renderHook(() =>
      useReadingProgress({
        chapterId: 10,
        bookId: 20,
        enabled: true,
        targetRef,
        initialProgress: 35,
      })
    );

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalled();
      expect(result.current).toBe(35);
      expect(window.scrollY).toBe(160);
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('ignores stale local reading position behind server progress', async () => {
    const targetRef = createTargetRef(2000, 200);
    const scrollToSpy = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation((x: number | ScrollToOptions, y?: number) => {
        if (typeof x === 'number') {
          setScrollY(y ?? 0);
          return;
        }

        setScrollY(typeof x.top === 'number' ? x.top : 0);
      });

    window.localStorage.setItem(
      'reading-position:20:10',
      JSON.stringify({ progress: 3, scrollY: 0 })
    );

    const { result } = renderHook(() =>
      useReadingProgress({
        chapterId: 10,
        bookId: 20,
        enabled: true,
        targetRef,
        initialProgress: 50,
      })
    );

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalledWith(window.scrollX, 600);
      expect(result.current).toBe(50);
      expect(window.scrollY).toBe(600);
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('flushes progress on click before client navigation can unmount the reader', async () => {
    const targetRef = createTargetRef(1600, 200);

    renderHook(() =>
      useReadingProgress({
        chapterId: 10,
        bookId: 20,
        enabled: true,
        targetRef,
      })
    );

    act(() => {
      setScrollY(400);
      document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/reading-progress',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ chapterId: 10, bookId: 20, progress: 50 }),
      })
    );
  });
});
