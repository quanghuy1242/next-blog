import React from 'react';
import Link from 'next/link';
import type { Book } from 'types/cms';
import { BookCover } from './book-cover';

interface BookItemProps {
  book: Book;
}

export function BookItem({ book }: BookItemProps) {
  return (
    <article className="flex w-44 flex-none flex-col gap-2 sm:w-48">
      <BookCover
        media={book.cover}
        title={book.title}
        href={`/books/${book.slug}`}
        className="w-full"
      />

      <h3 className="text-sm font-medium leading-snug sm:text-base">
        <Link href={`/books/${book.slug}`} className="hover:underline">
          {book.title}
        </Link>
      </h3>

      {book.author && <p className="text-xs text-gray-700">{book.author}</p>}
    </article>
  );
}