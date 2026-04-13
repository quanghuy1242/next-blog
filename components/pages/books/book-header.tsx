import React from 'react';
import type { Book } from 'types/cms';
import { CoverImage } from 'components/shared/cover-image';

interface BookHeaderProps {
  book: Book;
}

export function BookHeader({ book }: BookHeaderProps) {
  const hasImportProgress =
    typeof book.importTotalChapters === 'number' &&
    typeof book.importCompletedChapters === 'number';

  return (
    <header className="mb-8">
      {book.cover ? (
        <CoverImage media={book.cover} title={book.title} className="mb-4" />
      ) : (
        <div className="mb-4 h-44 w-full rounded-sm bg-gradient-to-br from-blue to-darkBlue shadow-small" />
      )}

      <h1 className="text-4xl font-bold leading-tight">{book.title}</h1>

      {book.author && <p className="mt-2 text-lg text-gray-700">{book.author}</p>}

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-blue px-2 py-1 text-white">{book.origin}</span>
        <span className="rounded bg-gray-200 px-2 py-1 text-gray-700">
          import: {book.importStatus}
        </span>
        <span className="rounded bg-gray-200 px-2 py-1 text-gray-700">
          sync: {book.syncStatus}
        </span>
      </div>

      {hasImportProgress && (
        <p className="mt-3 text-sm text-gray-600">
          Imported chapters: {book.importCompletedChapters}/{book.importTotalChapters}
        </p>
      )}

      {book.importErrorSummary && (
        <p className="mt-2 text-sm text-red-600">{book.importErrorSummary}</p>
      )}
    </header>
  );
}
