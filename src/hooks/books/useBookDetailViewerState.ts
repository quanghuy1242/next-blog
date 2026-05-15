'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { BookDetailViewerState } from '@/types/book-viewer-state';
import {
  readCachedBookDetailViewerState,
  writeCachedBookDetailViewerState,
} from '@/lib/browser/book-viewer-state-cache';

interface BooksViewerStateResponse {
  detail?: BookDetailViewerState | null;
}

/**
 * Hydrates mutable book-detail viewer state outside the server page path.
 *
 * The local snapshot is only a flicker guard. `/api/books/viewer-state` remains
 * the cross-device source of truth and always refreshes in the background.
 */
export function useBookDetailViewerState(bookId: number, isAuthenticated: boolean) {
  const [viewerState, setViewerState] = useState<BookDetailViewerState | null>(null);
  const [viewerStateLoaded, setViewerStateLoaded] = useState(!isAuthenticated);
  const viewerStateRef = useRef<BookDetailViewerState | null>(null);

  useEffect(() => {
    viewerStateRef.current = viewerState;
  }, [viewerState]);

  useLayoutEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const cachedViewerState = readCachedBookDetailViewerState(bookId);

    if (cachedViewerState) {
      viewerStateRef.current = cachedViewerState;
      setViewerState(cachedViewerState);
      setViewerStateLoaded(true);
      return;
    }

    viewerStateRef.current = null;
    setViewerState(null);
    setViewerStateLoaded(false);
  }, [bookId, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setViewerState(null);
      setViewerStateLoaded(true);
      return;
    }

    const controller = new AbortController();

    setViewerStateLoaded(viewerStateRef.current != null);

    async function loadViewerState() {
      try {
        const params = new URLSearchParams({
          bookIds: String(bookId),
          detail: '1',
        });
        const response = await fetch(`/api/books/viewer-state?${params.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as BooksViewerStateResponse;
        const detail = payload.detail ?? null;

        viewerStateRef.current = detail;
        setViewerState(detail);

        if (detail) {
          writeCachedBookDetailViewerState({
            ...detail,
            bookId,
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Failed to load book viewer state', error);
          setViewerState(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setViewerStateLoaded(true);
        }
      }
    }

    void loadViewerState();

    return () => {
      controller.abort();
    };
  }, [bookId, isAuthenticated]);

  return {
    viewerState,
    viewerStateLoaded,
  };
}
