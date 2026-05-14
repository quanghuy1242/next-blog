import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ChapterReaderClient } from '@/components/pages/books/chapter-reader-client';
import type { Book, Chapter } from '@/types/cms';

vi.mock('@/components/core/container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/core/layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/pages/books/chapter-content', () => ({
  ChapterContent: () => <h1>CHƯƠNG 24</h1>,
}));

vi.mock('@/components/pages/books/chapter-password-gate', () => ({
  ChapterPasswordGate: () => <div>Chapter password gate</div>,
}));

vi.mock('@/components/pages/books/chapter-toc', () => ({
  ChapterToc: () => <nav aria-label="Chapter table of contents" />, 
}));

vi.mock('@/components/pages/books/chapter-toc-drawer', () => ({
  ChapterTocDrawer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/utils/image', () => ({
  getCoverImageUrl: () => 'https://example.com/cover.jpg',
}));

vi.mock('@/components/shared/comments/CommentsSection', () => ({
  CommentsSection: () => <div data-testid="comments-section" />,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/books/1~the-wild-robot-escapes/chapters/chapter-24',
  useSearchParams: () => ({
    toString: () => '',
  }),
}));

vi.mock('@/lib/payload/reading-progress', () => ({
  getReadingProgress: vi.fn().mockResolvedValue([]),
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
    origin: (overrides.origin ?? 'manual') as Book['origin'],
    sourceType: (overrides.sourceType ?? 'manual') as Book['sourceType'],
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
  const defaultContent = {
    root: {
      children: [],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  } as never;

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
    content: overrides.content !== undefined ? overrides.content : defaultContent,
    hasPassword: overrides.hasPassword ?? false,
    createdBy: overrides.createdBy ?? null,
    _status: overrides._status ?? 'published',
    updatedAt: overrides.updatedAt ?? '2024-01-01',
    createdAt: overrides.createdAt ?? '2024-01-01',
  };
}

describe('ChapterPage', () => {
  test('renders the chapter title for manually created books', () => {
    render(
      <ChapterReaderClient
        book={createBook({ origin: 'manual' })}
        chapter={createChapter()}
        chapters={[createChapter()]}
        isDraftMode={false}
        isAuthenticated={false}
        readingProgress={[]}
      />
    );

    expect(screen.getAllByRole('heading', { name: 'CHƯƠNG 24', level: 1 })).toHaveLength(2);
  });

  test('hides the page chapter title for epub-imported books', () => {
    render(
      <ChapterReaderClient
        book={createBook({ origin: 'epub_imported' as never, sourceType: 'epub_upload' as never })}
        chapter={createChapter()}
        chapters={[createChapter()]}
        isDraftMode={false}
        isAuthenticated={false}
        readingProgress={[]}
      />
    );

    expect(screen.getAllByRole('heading', { name: 'CHƯƠNG 24', level: 1 })).toHaveLength(1);
  });

  test('renders the chapter password gate when locked content is unavailable', () => {
    render(
      <ChapterReaderClient
        book={createBook({ origin: 'manual' })}
        chapter={createChapter({ content: null, hasPassword: true })}
        chapters={[createChapter({ content: null, hasPassword: true })]}
        isDraftMode={false}
        isAuthenticated={false}
        readingProgress={[]}
      />
    );

    expect(screen.getByText('Chapter password gate')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'CHƯƠNG 24', level: 1 })).toHaveLength(1);
  });
});
