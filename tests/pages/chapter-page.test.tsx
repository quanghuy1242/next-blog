import React from 'react';
import { render, screen } from '@testing-library/react';
import ChapterPage from 'pages/books/[slug]/chapters/[chapterSlug]';
import type { Book, Chapter, Homepage } from 'types/cms';

vi.mock('components/core/container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('components/core/layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('components/core/metadata', () => ({
  renderMetaTags: () => null,
}));

vi.mock('components/pages/books/chapter-content', () => ({
  ChapterContent: () => <h1>CHƯƠNG 24</h1>,
}));

vi.mock('components/pages/books/chapter-toc', () => ({
  ChapterToc: () => <nav aria-label="Chapter table of contents" />, 
}));

vi.mock('components/pages/books/chapter-toc-drawer', () => ({
  ChapterTocDrawer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('common/utils/image', () => ({
  getCoverImageUrl: () => 'https://example.com/cover.jpg',
}));

vi.mock('common/utils/meta-tags', () => ({
  generateMetaTags: () => ({}),
}));

function createBook(overrides: Partial<Book> = {}): Book {
  return {
    id: overrides.id ?? 1,
    title: overrides.title ?? 'The Wild Robot Escapes',
    author: overrides.author ?? 'Peter Brown',
    slug: overrides.slug ?? 'the-wild-robot-escapes',
    cover: overrides.cover ?? {
      id: 1,
      url: 'https://example.com/cover.jpg',
      alt: 'Book cover',
      width: 800,
      height: 400,
    },
    origin: overrides.origin ?? 'manual',
    sourceType: overrides.sourceType ?? 'manual',
    sourceId: overrides.sourceId ?? null,
    sourceHash: overrides.sourceHash ?? null,
    sourceVersion: overrides.sourceVersion ?? null,
    syncStatus: overrides.syncStatus ?? 'clean',
    importBatchId: overrides.importBatchId ?? null,
    importStatus: overrides.importStatus ?? 'idle',
    importTotalChapters: overrides.importTotalChapters ?? null,
    importCompletedChapters: overrides.importCompletedChapters ?? null,
    importStartedAt: overrides.importStartedAt ?? null,
    importFinishedAt: overrides.importFinishedAt ?? null,
    importFailedAt: overrides.importFailedAt ?? null,
    lastImportedAt: overrides.lastImportedAt ?? null,
    importErrorSummary: overrides.importErrorSummary ?? null,
    createdBy: overrides.createdBy ?? null,
    _status: overrides._status ?? 'published',
    updatedAt: overrides.updatedAt ?? '2024-01-01',
    createdAt: overrides.createdAt ?? '2024-01-01',
  };
}

function createChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: overrides.id ?? 1,
    title: overrides.title ?? 'CHƯƠNG 24',
    book: overrides.book ?? 1,
    order: overrides.order ?? 24,
    slug: overrides.slug ?? 'chapter-24',
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

function createHomepage(): Pick<Homepage, 'header'> {
  return { header: 'Dark Blue Pattern' };
}

describe('ChapterPage', () => {
  test('renders the chapter title for manually created books', () => {
    render(
      <ChapterPage
        book={createBook({ origin: 'manual' })}
        chapter={createChapter()}
        chapters={[createChapter()]}
        homepage={createHomepage()}
      />
    );

    expect(screen.getAllByRole('heading', { name: 'CHƯƠNG 24', level: 1 })).toHaveLength(2);
  });

  test('hides the page chapter title for epub-imported books', () => {
    render(
      <ChapterPage
        book={createBook({ origin: 'epub-imported' })}
        chapter={createChapter()}
        chapters={[createChapter()]}
        homepage={createHomepage()}
      />
    );

    expect(screen.getAllByRole('heading', { name: 'CHƯƠNG 24', level: 1 })).toHaveLength(1);
  });
});