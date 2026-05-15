import { useCallback, useEffect, useState } from 'react';
import type { BookmarkRecord } from '@/types/cms';
import {
  readCachedBookCardViewerStates,
  readCachedBookDetailViewerState,
  writeCachedBookCardViewerStates,
  writeCachedBookDetailViewerState,
  writeCachedChapterBookmark,
} from '@/lib/browser/book-viewer-state-cache';

interface UseBookmarkOptions {
  contentType: 'chapter' | 'book';
  contentId: number;
  enabled: boolean;
  initialBookmark?: BookmarkRecord | null;
  refreshOnMount?: boolean;
}

interface UseBookmarkState {
  bookmark: BookmarkRecord | null;
  isBookmarked: boolean;
  isLoading: boolean;
  isMutating: boolean;
}

export function useBookmark({
  contentType,
  contentId,
  enabled,
  initialBookmark = null,
  refreshOnMount = false,
}: UseBookmarkOptions): UseBookmarkState & {
  toggle: () => Promise<void>;
} {
  const [bookmark, setBookmark] = useState<BookmarkRecord | null>(initialBookmark);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    setBookmark(initialBookmark);
  }, [contentType, contentId, initialBookmark]);

  useEffect(() => {
    if (!enabled || !contentId || !refreshOnMount) {
      return;
    }

    let cancelled = false;

    async function loadBookmark() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ contentType, contentId: String(contentId) });
        const response = await fetch(`/api/bookmarks?${params}`);
        if (!response.ok) {
          if (!cancelled) setBookmark(null);
          return;
        }
        const data = await response.json();
        if (!cancelled) {
          setBookmark(data?.docs?.[0] ?? null);
        }
      } catch {
        if (!cancelled) setBookmark(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadBookmark();

    return () => {
      cancelled = true;
    };
  }, [contentType, contentId, enabled, refreshOnMount]);

  const toggle = useCallback(async () => {
    if (isMutating) return;

    setIsMutating(true);

    const previousBookmark = bookmark;

    try {
      if (previousBookmark) {
        setBookmark(null);
        persistCachedBookmarkState(contentType, contentId, null);
        const response = await fetch(`/api/bookmarks/${previousBookmark.id}`, { method: 'DELETE' });
        if (!response.ok) {
          setBookmark(previousBookmark);
          persistCachedBookmarkState(contentType, contentId, previousBookmark);
        }
      } else {
        const optimisticBookmark: BookmarkRecord = {
          id: -1,
          contentType,
          chapter: contentType === 'chapter' ? { id: contentId, title: '', slug: '', book: null } : null,
          book: contentType === 'book' ? { id: contentId, title: '', slug: '' } : null,
        };
        setBookmark(optimisticBookmark);
        persistCachedBookmarkState(contentType, contentId, optimisticBookmark);

        const body: Record<string, string> = { contentType };
        if (contentType === 'chapter') {
          body.chapterId = String(contentId);
        } else {
          body.bookId = String(contentId);
        }

        const response = await fetch('/api/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          const data = await response.json();
          if (typeof data?.bookmarkId === 'number' && Number.isFinite(data.bookmarkId)) {
            setBookmark({
              ...optimisticBookmark,
              id: data.bookmarkId,
            });
            persistCachedBookmarkState(contentType, contentId, {
              ...optimisticBookmark,
              id: data.bookmarkId,
            });
          } else {
            setBookmark(previousBookmark);
            persistCachedBookmarkState(contentType, contentId, previousBookmark);
          }
        } else {
          setBookmark(previousBookmark);
          persistCachedBookmarkState(contentType, contentId, previousBookmark);
        }
      }
    } catch {
      setBookmark(previousBookmark);
      persistCachedBookmarkState(contentType, contentId, previousBookmark);
    } finally {
      setIsMutating(false);
    }
  }, [bookmark, isMutating, contentType, contentId]);

  return {
    bookmark,
    isBookmarked: bookmark != null,
    isLoading,
    isMutating,
    toggle,
  };
}

// Keep optimistic bookmark mutations in sync with the viewer-state snapshot cache.
// Otherwise the next navigation can replay stale bookmark UI until the refresh returns.
function persistCachedBookmarkState(
  contentType: 'chapter' | 'book',
  contentId: number,
  bookmark: BookmarkRecord | null
) {
  if (contentType === 'chapter') {
    writeCachedChapterBookmark(contentId, bookmark);
    return;
  }

  const cachedDetail = readCachedBookDetailViewerState(contentId);

  if (cachedDetail) {
    writeCachedBookDetailViewerState({
      ...cachedDetail,
      bookmark,
    });
  }

  const cachedCard = readCachedBookCardViewerStates([contentId])[contentId];

  writeCachedBookCardViewerStates([
    {
      bookId: contentId,
      isBookmarked: bookmark != null,
      bookmarkId: bookmark?.id ?? null,
      readingProgressPct: cachedCard?.readingProgressPct ?? cachedDetail?.wholeBookProgress ?? 0,
    },
  ]);
}
