import { describe, expect, test } from 'vitest';
import { calculateWholeBookProgress } from 'common/utils/reading-progress';
import type { ReadingProgressRecord } from 'types/cms';

function createRecord(
  chapterId: string,
  progress: number
): ReadingProgressRecord {
  return {
    chapterId,
    progress,
    completedAt: null,
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

describe('calculateWholeBookProgress', () => {
  test('weights chapter progress by chapter word count', () => {
    const progress = calculateWholeBookProgress({
      chapters: [
        { id: 1, chapterWordCount: 1000 },
        { id: 2, chapterWordCount: 3000 },
      ],
      records: [createRecord('1', 100), createRecord('2', 50)],
      totalWordCount: 4000,
    });

    expect(progress).toBe(63);
  });

  test('falls back to equal chapter weighting when word counts are incomplete', () => {
    const progress = calculateWholeBookProgress({
      chapters: [
        { id: 1, chapterWordCount: 1000 },
        { id: 2, chapterWordCount: null },
        { id: 3, chapterWordCount: null },
      ],
      records: [createRecord('1', 100), createRecord('2', 50)],
      totalWordCount: null,
    });

    expect(progress).toBe(50);
  });

  test('returns 0 when a book has no chapters', () => {
    const progress = calculateWholeBookProgress({
      chapters: [],
      records: [createRecord('1', 100)],
      totalWordCount: 1000,
    });

    expect(progress).toBe(0);
  });
});
