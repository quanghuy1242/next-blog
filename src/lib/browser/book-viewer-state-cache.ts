import type { BookmarkRecord } from '@/types/cms';
import type {
  BookCardViewerState,
  BookDetailViewerState,
} from '@/types/book-viewer-state';

const CACHE_VERSION = 1;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const BOOK_DETAIL_PREFIX = 'book-viewer-state:detail:';
const BOOK_CARD_PREFIX = 'book-viewer-state:card:';
const CHAPTER_BOOKMARK_PREFIX = 'book-viewer-state:chapter-bookmark:';

/**
 * Browser-only UX cache for authenticated book viewer state.
 *
 * This is not an authorization or data-consistency layer. It only replays the last
 * successful bookmark/progress payload before paint so repeat navigations do not flash
 * from empty state to hydrated state. Fresh no-store viewer-state requests still run
 * after render and remain the cross-device source of truth.
 */
export type CachedBookCardViewerState = BookCardViewerState;
export type CachedBookDetailViewerState = BookDetailViewerState;

interface CacheEnvelope<T> {
  version: number;
  cachedAt: number;
  value: T;
}

export function readCachedBookCardViewerStates(
  bookIds: number[]
): Record<number, CachedBookCardViewerState> {
  const entries = bookIds
    .map((bookId) => readCacheValue<CachedBookCardViewerState>(getBookCardKey(bookId)))
    .filter((state): state is CachedBookCardViewerState => state != null);

  return Object.fromEntries(entries.map((state) => [state.bookId, state]));
}

export function writeCachedBookCardViewerStates(states: CachedBookCardViewerState[]) {
  for (const state of states) {
    writeCacheValue(getBookCardKey(state.bookId), state);
  }
}

export function readCachedBookDetailViewerState(
  bookId: number
): CachedBookDetailViewerState | null {
  return readCacheValue<CachedBookDetailViewerState>(getBookDetailKey(bookId));
}

export function writeCachedBookDetailViewerState(state: CachedBookDetailViewerState) {
  writeCacheValue(getBookDetailKey(state.bookId), state);
  writeCachedBookCardViewerStates([
    {
      bookId: state.bookId,
      isBookmarked: state.bookmark != null,
      bookmarkId: state.bookmark?.id ?? null,
      readingProgressPct: state.wholeBookProgress,
    },
  ]);
}

export function readCachedChapterBookmark(
  chapterId: number
): BookmarkRecord | null | undefined {
  return readCacheValue<BookmarkRecord | null>(getChapterBookmarkKey(chapterId));
}

export function writeCachedChapterBookmark(
  chapterId: number,
  bookmark: BookmarkRecord | null
) {
  writeCacheValue(getChapterBookmarkKey(chapterId), bookmark);
}

function getBookDetailKey(bookId: number) {
  return `${BOOK_DETAIL_PREFIX}${bookId}`;
}

function getBookCardKey(bookId: number) {
  return `${BOOK_CARD_PREFIX}${bookId}`;
}

function getChapterBookmarkKey(chapterId: number) {
  return `${CHAPTER_BOOKMARK_PREFIX}${chapterId}`;
}

function readCacheValue<T>(key: string): T | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(key);

    if (!rawValue) {
      return null;
    }

    const envelope = JSON.parse(rawValue) as Partial<CacheEnvelope<T>>;

    if (
      envelope.version !== CACHE_VERSION ||
      typeof envelope.cachedAt !== 'number' ||
      Date.now() - envelope.cachedAt > CACHE_TTL_MS ||
      !('value' in envelope)
    ) {
      window.localStorage.removeItem(key);
      return null;
    }

    return envelope.value as T;
  } catch {
    return null;
  }
}

function writeCacheValue<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: CACHE_VERSION,
        cachedAt: Date.now(),
        value,
      } satisfies CacheEnvelope<T>)
    );
  } catch {
    // Ignore storage failures.
  }
}
