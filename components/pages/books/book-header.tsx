import React from 'react';
import type { Book } from 'types/cms';
import { BookCover } from 'components/shared/book-cover';

interface BookHeaderProps {
  book: Book;
}

export function BookHeader({ book }: BookHeaderProps) {
  return (
    <header className="mb-8">
      <div className="grid gap-6 md:grid-cols-[180px_minmax(0,1fr)] md:items-start">
        <BookCover
          media={book.cover}
          title={book.title}
          priority
          className="w-full max-w-[180px]"
        />

        <div className="flex flex-col justify-center">
          <h1 className="text-3xl font-bold leading-tight md:text-4xl">{book.title}</h1>

          {book.author && <p className="mt-3 text-base text-gray-700 md:text-lg">{book.author}</p>}
        </div>
      </div>
    </header>
  );
}
