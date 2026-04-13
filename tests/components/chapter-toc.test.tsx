import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChapterToc } from 'components/pages/books/chapter-toc';
import type { Chapter } from 'types/cms';

function createChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: overrides.id ?? 1,
    title: overrides.title ?? 'Chapter 1',
    book: overrides.book ?? 1,
    order: overrides.order ?? 1,
    slug: overrides.slug ?? 'chapter-1',
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

describe('ChapterToc component', () => {
  test('highlights current chapter', () => {
    const chapters = [
      createChapter({ slug: 'ch-1', title: 'One', order: 1 }),
      createChapter({ id: 2, slug: 'ch-2', title: 'Two', order: 2 }),
    ];

    render(
      <ChapterToc
        chapters={chapters}
        bookSlug="sample-book"
        currentChapterSlug="ch-2"
      />
    );

    const activeLink = screen.getByRole('link', { name: /Two/i });
    expect(activeLink.className).toContain('bg-blue');
    expect(activeLink).toHaveAttribute('href', '/books/sample-book/chapters/ch-2');
  });

  test('calls onNavigate when a chapter is clicked', () => {
    const onNavigate = vi.fn();
    const chapters = [createChapter({ slug: 'ch-1', title: 'One' })];

    render(
      <ChapterToc
        chapters={chapters}
        bookSlug="sample-book"
        currentChapterSlug="ch-1"
        onNavigate={onNavigate}
      />
    );

    fireEvent.click(screen.getByRole('link', { name: /One/i }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
