import React from 'react';
import type { Book } from 'types/cms';
import { BookItem } from './book-item';

interface BooksGridProps {
  books: Book[];
  bookmarkedBookIds?: number[];
}

export function BooksGrid({ books, bookmarkedBookIds = [] }: BooksGridProps) {
  const bookmarkedBookIdSet = new Set(bookmarkedBookIds);

  return (
    <div className="flex flex-wrap justify-start gap-4 sm:gap-8">
      {books.map((book) => (
        <BookItem
          key={book.slug}
          book={book}
          isBookmarked={bookmarkedBookIdSet.has(book.id)}
        />
      ))}
    </div>
  );
}
