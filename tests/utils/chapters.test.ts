import { sortChapters } from 'common/apis/chapters';
import type { Chapter } from 'types/cms';

function createChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: overrides.id ?? 1,
    title: overrides.title ?? 'Chapter',
    book: overrides.book ?? 1,
    order: overrides.order ?? 1,
    slug: overrides.slug ?? 'chapter',
    chapterSourceKey: overrides.chapterSourceKey ?? null,
    chapterSourceHash: overrides.chapterSourceHash ?? null,
    importBatchId: overrides.importBatchId ?? null,
    manualEditedAt: overrides.manualEditedAt ?? null,
    content:
      overrides.content ??
      ({
        root: {
          children: [],
          direction: null,
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        },
      } as never),
    createdBy: overrides.createdBy ?? null,
    _status: overrides._status ?? 'published',
    updatedAt: overrides.updatedAt ?? '2024-01-01',
    createdAt: overrides.createdAt ?? '2024-01-01',
  };
}

describe('sortChapters', () => {
  test('sorts by order first', () => {
    const result = sortChapters([
      createChapter({ id: 2, order: 3, slug: 'three' }),
      createChapter({ id: 1, order: 1, slug: 'one' }),
      createChapter({ id: 3, order: 2, slug: 'two' }),
    ]);

    expect(result.map((chapter) => chapter.slug)).toEqual(['one', 'two', 'three']);
  });

  test('uses createdAt and id as tie breakers', () => {
    const result = sortChapters([
      createChapter({ id: 3, order: 1, slug: 'three', createdAt: '2024-01-02' }),
      createChapter({ id: 2, order: 1, slug: 'two', createdAt: '2024-01-01' }),
      createChapter({ id: 1, order: 1, slug: 'one', createdAt: '2024-01-01' }),
    ]);

    expect(result.map((chapter) => chapter.slug)).toEqual(['one', 'two', 'three']);
  });
});
