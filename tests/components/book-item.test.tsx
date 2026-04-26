import React from 'react';
import { render, screen } from '@testing-library/react';
import { BookItem } from 'components/shared/book-item';
import type { Book } from 'types/cms';

function createBook(overrides: Partial<Book> = {}): Book {
  return {
    id: overrides.id ?? 1,
    title: overrides.title ?? 'Sample Book',
    author: overrides.author ?? 'Author',
    slug: overrides.slug ?? 'sample-book',
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

describe('BookItem component', () => {
  test('renders portrait book cover with title and author only', () => {
    render(<BookItem book={createBook()} />);

    const bookLinks = screen.getAllByRole('link', { name: /Sample Book/i });
    const item = screen.getByText('Sample Book').closest('article');

    expect(bookLinks).toHaveLength(2);
    expect(bookLinks[0]).toHaveAttribute('href', '/books/1~sample-book');
    expect(bookLinks[1]).toHaveAttribute('href', '/books/1~sample-book');
    expect(item).toHaveClass('w-40');
    expect(item).toHaveClass('sm:w-48');
    expect(screen.getByText('Author')).toBeInTheDocument();
    expect(screen.getByAltText('Cover image for Sample Book')).toBeInTheDocument();
    expect(screen.queryByText('manual')).not.toBeInTheDocument();
    expect(screen.queryByText('idle')).not.toBeInTheDocument();
  });
});
