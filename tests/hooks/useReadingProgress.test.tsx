import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useReadingProgress } from 'hooks/useReadingProgress';

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

describe('useReadingProgress', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'innerHeight', {
      value: 600,
      writable: true,
      configurable: true,
    });
    setScrollY(0);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
    } as Response);
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
});
