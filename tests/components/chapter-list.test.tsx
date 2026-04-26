import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChapterList } from 'components/pages/books/chapter-list';
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

describe('ChapterList component', () => {
  test('renders chapter links', () => {
    render(
      <ChapterList
        bookId={1}
        bookSlug="sample-book"
        chapters={[createChapter({ slug: 'chapter-1', order: 1, title: 'Intro' })]}
      />
    );

    expect(screen.getByRole('link', { name: /Intro/i })).toHaveAttribute(
      'href',
      '/books/1~sample-book/chapters/chapter-1'
    );
  });

  test('renders empty state when no chapters are available', () => {
    render(<ChapterList bookId={1} bookSlug="sample-book" chapters={[]} />);

    expect(screen.getByText('No chapters are available yet.')).toBeInTheDocument();
  });
});
