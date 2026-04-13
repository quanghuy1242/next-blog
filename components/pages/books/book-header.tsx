import React from 'react';
import type { Book } from 'types/cms';
import { BookCover } from 'components/shared/book-cover';

interface BookHeaderProps {
  book: Book;
}

export function BookHeader({ book }: BookHeaderProps) {
  return (
    <header className="mb-8">
      <div className="grid gap-8 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)] md:items-start">
        <BookCover media={book.cover} title={book.title} priority className="w-full" />

        <div className="flex flex-col justify-center">
          <h1 className="text-4xl font-bold leading-tight">{book.title}</h1>

          {book.author && <p className="mt-3 text-lg text-gray-700">{book.author}</p>}
        </div>
      </div>
    </header>
  );
}
