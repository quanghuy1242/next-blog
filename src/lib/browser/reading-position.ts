import type { Chapter } from '@/types/cms';

export interface StoredReadingPosition {
  progress: number;
  scrollY: number;
}

function getReadingPositionKey(bookId: number, chapterId: number) {
  return `reading-position:${bookId}:${chapterId}`;
}

function clampProgress(progress: number) {
  return Math.min(Math.max(progress, 0), 100);
}

export function readReadingPosition(
  bookId: number,
  chapterId: number
): StoredReadingPosition | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(getReadingPositionKey(bookId, chapterId));
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<StoredReadingPosition>;
    const progress =
      typeof parsedValue.progress === 'number' ? parsedValue.progress : NaN;
    const scrollY =
      typeof parsedValue.scrollY === 'number' ? parsedValue.scrollY : NaN;

    if (!Number.isFinite(progress) || !Number.isFinite(scrollY)) {
      return null;
    }

    return {
      progress: clampProgress(progress),
      scrollY: Math.max(scrollY, 0),
    };
  } catch {
    return null;
  }
}

export function writeReadingPosition(
  bookId: number,
  chapterId: number,
  position: StoredReadingPosition
) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      getReadingPositionKey(bookId, chapterId),
      JSON.stringify({
        progress: clampProgress(position.progress),
        scrollY: Math.max(position.scrollY, 0),
      } satisfies StoredReadingPosition)
    );
  } catch {
    // Ignore storage failures.
  }
}

export function readReadingProgressByChapterId(
  bookId: number,
  chapters: Array<Pick<Chapter, 'id'>>
): Record<number, number> {
  const progressByChapterId: Record<number, number> = {};

  for (const chapter of chapters) {
    const storedPosition = readReadingPosition(bookId, chapter.id);

    if (storedPosition && storedPosition.progress > 0) {
      progressByChapterId[chapter.id] = storedPosition.progress;
    }
  }

  return progressByChapterId;
}
