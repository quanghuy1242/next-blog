import { useCallback, useEffect, useState } from 'react';
import type { BookmarkRecord } from 'types/cms';

interface UseBookmarkOptions {
  contentType: 'chapter' | 'book';
  contentId: number;
  enabled: boolean;
}

interface UseBookmarkState {
  bookmark: BookmarkRecord | null;
  isBookmarked: boolean;
  isLoading: boolean;
  isMutating: boolean;
}

export function useBookmark({ contentType, contentId, enabled }: UseBookmarkOptions): UseBookmarkState & {
  toggle: () => Promise<void>;
} {
  const [bookmark, setBookmark] = useState<BookmarkRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    if (!enabled || !contentId) return;

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
  }, [contentType, contentId, enabled]);

  const toggle = useCallback(async () => {
    if (isMutating) return;

    setIsMutating(true);

    const previousBookmark = bookmark;

    try {
      if (previousBookmark) {
        setBookmark(null);
        const response = await fetch(`/api/bookmarks/${previousBookmark.id}`, { method: 'DELETE' });
        if (!response.ok) {
          setBookmark(previousBookmark);
        }
      } else {
        const optimisticBookmark: BookmarkRecord = {
          id: '__optimistic__',
          contentType,
          chapter: contentType === 'chapter' ? { id: contentId, title: '', slug: '', book: null } : null,
          book: contentType === 'book' ? { id: contentId, title: '', slug: '' } : null,
        };
        setBookmark(optimisticBookmark);

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
          if (typeof data?.bookmarkId === 'string' && data.bookmarkId.length > 0) {
            setBookmark({
              ...optimisticBookmark,
              id: data.bookmarkId,
            });
          } else {
            setBookmark(previousBookmark);
          }
        } else {
          setBookmark(previousBookmark);
        }
      }
    } catch {
      setBookmark(previousBookmark);
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
