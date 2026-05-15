import type { BookmarkRecord, ReadingProgressRecord } from '@/types/cms';

export interface BookCardViewerState {
  bookId: number;
  isBookmarked: boolean;
  bookmarkId: number | null;
  readingProgressPct: number;
}

export interface BookDetailViewerState {
  bookId: number;
  bookmark: BookmarkRecord | null;
  readingProgress: ReadingProgressRecord[];
  readingProgressByChapterId?: Record<number, number>;
  continueReadingChapterSlug: string | null;
  wholeBookProgress: number;
}

export interface ChapterViewerState {
  bookmark: BookmarkRecord | null;
  readingProgress: ReadingProgressRecord[];
  readingProgressByChapterId?: Record<number, number>;
}
