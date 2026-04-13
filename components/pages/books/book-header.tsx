import React from 'react';
import type { Book } from 'types/cms';
import { BookCover } from 'components/shared/book-cover';

interface BookHeaderProps {
  book: Book;
}

export function BookHeader({ book }: BookHeaderProps) {
  return (
    <header className="mb-8">
      <div className="flex items-start gap-4 sm:gap-6">
        <BookCover
          media={book.cover}
          title={book.title}
          priority
          className="w-24 flex-shrink-0 sm:w-28 md:w-32"
        />

        <div className="min-w-0 flex-1 pt-1">
          <h1 className="text-2xl font-bold leading-tight md:text-3xl">{book.title}</h1>

          {book.author && <p className="mt-2 text-sm text-gray-700 md:text-base">{book.author}</p>}
        </div>
      </div>
    </header>
  );
}
