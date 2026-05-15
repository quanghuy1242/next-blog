import type { ReadingProgressRecord } from '@/types/cms';

export function progressByChapterIdFromRecords(records: ReadingProgressRecord[]) {
  if (!records.length) {
    return undefined;
  }

  return Object.fromEntries(
    records
      .filter((record) => record.chapterId != null && record.progress != null)
      .map((record) => [Number(record.chapterId!), record.progress!])
  ) as Record<number, number>;
}

export function mergeProgressByChapterId(
  serverProgressByChapterId?: Record<number, number>,
  localProgressByChapterId: Record<number, number> = {}
) {
  const merged: Record<number, number> = {
    ...(serverProgressByChapterId ?? {}),
  };

  for (const [chapterId, localProgress] of Object.entries(localProgressByChapterId)) {
    const numericChapterId = Number(chapterId);
    const serverProgress = merged[numericChapterId] ?? 0;
    merged[numericChapterId] = Math.max(serverProgress, localProgress);
  }

  return merged;
}

export function mergeReaderProgressForDisplay({
  chapterId,
  currentReadingProgress,
  localProgressByChapterId,
  serverProgressByChapterId,
  shouldTrackProgress,
}: {
  chapterId: number;
  currentReadingProgress: number;
  localProgressByChapterId: Record<number, number>;
  serverProgressByChapterId?: Record<number, number>;
  shouldTrackProgress: boolean;
}) {
  return {
    ...mergeProgressByChapterId(serverProgressByChapterId, localProgressByChapterId),
    [chapterId]: shouldTrackProgress
      ? currentReadingProgress
      : (serverProgressByChapterId?.[chapterId] ?? 0),
  };
}

export function recordsFromProgressMap(
  progressByChapterId: Record<number, number>
): ReadingProgressRecord[] {
  return Object.entries(progressByChapterId).map(([chapterId, progress]) => ({
    chapterId,
    progress,
    completedAt: progress >= 95 ? '' : null,
    updatedAt: '',
  }));
}
