import React from 'react';
import type { Book } from 'types/cms';
import { BookItem } from './book-item';

interface BooksGridProps {
  books: Book[];
}

export function BooksGrid({ books }: BooksGridProps) {
  return (
    <div className="flex flex-wrap justify-center gap-8">
      {books.map((book) => (
        <BookItem key={book.slug} book={book} />
      ))}
    </div>
  );
}
