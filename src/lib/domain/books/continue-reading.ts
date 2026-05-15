import type { Chapter, ReadingProgressRecord } from '@/types/cms';

type ContinueReadingChapter = Pick<Chapter, 'id' | 'slug'>;

function getRecordUpdatedAt(record: ReadingProgressRecord): string {
  return record.updatedAt ?? '';
}

export function getContinueReadingChapterSlug(
  chapters: ContinueReadingChapter[],
  readingProgress: ReadingProgressRecord[]
): string | null {
  if (!chapters.length || !readingProgress.length) {
    return null;
  }

  const chapterIndexById = new Map<number, number>();
  const chapterSlugById = new Map<number, string>();

  chapters.forEach((chapter, index) => {
    chapterIndexById.set(chapter.id, index);
    chapterSlugById.set(chapter.id, chapter.slug);
  });

  const readableProgress = readingProgress
    .map((record) => ({
      chapterId: record.chapterId == null ? null : Number(record.chapterId),
      progress: record.progress,
      updatedAt: getRecordUpdatedAt(record),
    }))
    .filter(
      (record): record is { chapterId: number; progress: number; updatedAt: string } =>
        record.chapterId != null &&
        Number.isFinite(record.chapterId) &&
        record.progress != null &&
        chapterIndexById.has(record.chapterId)
    );

  const latestIncomplete = readableProgress
    .filter((record) => record.progress < 95)
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))[0];

  if (latestIncomplete) {
    return chapterSlugById.get(latestIncomplete.chapterId) ?? null;
  }

  const furthestCompletedIndex = readableProgress
    .filter((record) => record.progress >= 95)
    .reduce((furthestIndex, record) => {
      const chapterIndex = chapterIndexById.get(record.chapterId);
      return chapterIndex == null ? furthestIndex : Math.max(furthestIndex, chapterIndex);
    }, -1);

  const nextChapter = chapters[furthestCompletedIndex + 1];

  return nextChapter?.slug ?? null;
}
