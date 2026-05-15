import { describe, expect, test } from 'vitest';
import { getContinueReadingChapterSlug } from '@/lib/domain/books/continue-reading';
import type { Chapter, ReadingProgressRecord } from '@/types/cms';

function chapter(id: number, slug: string): Pick<Chapter, 'id' | 'slug'> {
  return { id, slug };
}

function record(
  chapterId: string,
  progress: number,
  updatedAt = '2026-05-01T00:00:00.000Z'
): ReadingProgressRecord {
  return {
    chapterId,
    progress,
    completedAt: progress >= 95 ? updatedAt : null,
    updatedAt,
  };
}

describe('getContinueReadingChapterSlug', () => {
  test('returns the latest incomplete chapter', () => {
    expect(
      getContinueReadingChapterSlug(
        [chapter(1, 'chapter-1'), chapter(2, 'chapter-2')],
        [
          record('1', 30, '2026-05-01T00:00:00.000Z'),
          record('2', 50, '2026-05-02T00:00:00.000Z'),
        ]
      )
    ).toBe('chapter-2');
  });

  test('continues to the next chapter after the furthest completed chapter', () => {
    expect(
      getContinueReadingChapterSlug(
        [chapter(3, 'chuong-1'), chapter(4, 'chuong-2'), chapter(5, 'chuong-3')],
        [record('3', 100, '2026-05-14T17:36:15.023Z')]
      )
    ).toBe('chuong-2');
  });

  test('returns null when every chapter is complete', () => {
    expect(
      getContinueReadingChapterSlug(
        [chapter(1, 'chapter-1'), chapter(2, 'chapter-2')],
        [record('1', 100), record('2', 100)]
      )
    ).toBeNull();
  });

  test('returns null when the book has no progress yet', () => {
    expect(getContinueReadingChapterSlug([chapter(1, 'chapter-1')], [])).toBeNull();
  });
});
