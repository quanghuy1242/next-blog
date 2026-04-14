import React from 'react';
import { render, screen } from '@testing-library/react';
import { BooksGrid } from 'components/shared/books-grid';
import type { Book } from 'types/cms';

function createBook(title: string, slug: string): Book {
  return {
    id: slug === 'sample-book' ? 1 : 2,
    title,
    author: 'Author',
    slug,
    cover: {
      id: 1,
      url: 'https://example.com/cover.jpg',
      alt: 'Book cover',
      width: 800,
      height: 400,
    },
    origin: 'manual',
    sourceType: 'manual',
    sourceId: null,
    sourceHash: null,
    sourceVersion: null,
    syncStatus: 'clean',
    importBatchId: null,
    importStatus: 'idle',
    importTotalChapters: null,
    importCompletedChapters: null,
    importStartedAt: null,
    importFinishedAt: null,
    importFailedAt: null,
    lastImportedAt: null,
    importErrorSummary: null,
    createdBy: null,
    _status: 'published',
    updatedAt: '2024-01-01',
    createdAt: '2024-01-01',
  };
}

describe('BooksGrid component', () => {
  test('uses a wrapped flex layout for books', () => {
    const { container } = render(
      <BooksGrid
        books={[
          createBook('Sample Book', 'sample-book'),
          createBook('Second Book', 'second-book'),
        ]}
      />
    );

    expect(container.firstChild).toHaveClass(
      'flex',
      'flex-wrap',
      'justify-center',
      'gap-8'
    );
    expect(screen.getByText('Sample Book')).toBeInTheDocument();
    expect(screen.getByText('Second Book')).toBeInTheDocument();
  });
});
