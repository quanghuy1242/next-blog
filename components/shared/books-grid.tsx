import React from 'react';
import cn from 'classnames';
import type { Book } from 'types/cms';
import { BookItem } from './book-item';

interface BooksGridProps {
  books: Book[];
  hasMoreCol?: boolean;
}

export function BooksGrid({ books, hasMoreCol = true }: BooksGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-y-10',
        'lg:gap-x-10',
        'md:gap-x-10 md:gap-y-10',
        { 'md:grid-cols-2': hasMoreCol, 'md:grid-cols-1': !hasMoreCol }
      )}
    >
      {books.map((book) => (
        <BookItem key={book.slug} book={book} />
      ))}
    </div>
  );
}
