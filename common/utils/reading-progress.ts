import type { Chapter, ReadingProgressRecord } from 'types/cms';

interface CalculateWholeBookProgressOptions {
  chapters: Array<Pick<Chapter, 'id' | 'chapterWordCount'>>;
  records: ReadingProgressRecord[];
  totalWordCount?: number | null;
}

function clampProgress(progress: number): number {
  return Math.min(Math.max(progress, 0), 100);
}

export function calculateWholeBookProgress({
  chapters,
  records,
  totalWordCount,
}: CalculateWholeBookProgressOptions): number {
  if (!chapters.length) {
    return 0;
  }

  const progressByChapterId = new Map<number, number>();

  for (const record of records) {
    if (record.chapterId == null || record.progress == null) {
      continue;
    }

    const chapterId = Number(record.chapterId);
    if (!Number.isFinite(chapterId)) {
      continue;
    }

    progressByChapterId.set(chapterId, clampProgress(record.progress));
  }

  const hasCompleteWordCounts = chapters.every(
    (chapter) =>
      typeof chapter.chapterWordCount === 'number' && chapter.chapterWordCount > 0
  );

  if (hasCompleteWordCounts) {
    const resolvedTotalWordCount =
      typeof totalWordCount === 'number' && totalWordCount > 0
        ? totalWordCount
        : chapters.reduce(
            (sum, chapter) => sum + (chapter.chapterWordCount ?? 0),
            0
          );

    if (resolvedTotalWordCount > 0) {
      const readWordCount = chapters.reduce((sum, chapter) => {
        const progress = progressByChapterId.get(chapter.id) ?? 0;
        return sum + ((chapter.chapterWordCount ?? 0) * progress) / 100;
      }, 0);

      return clampProgress(
        Math.round((readWordCount / resolvedTotalWordCount) * 100)
      );
    }
  }

  const aggregateProgress = chapters.reduce((sum, chapter) => {
    return sum + (progressByChapterId.get(chapter.id) ?? 0);
  }, 0);

  return clampProgress(Math.round(aggregateProgress / chapters.length));
}
