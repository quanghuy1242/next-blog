import React from 'react';
import Link from 'next/link';
import type { Book } from 'types/cms';
import { BookCover } from './book-cover';

interface BookItemProps {
  book: Book;
}

export function BookItem({ book }: BookItemProps) {
  return (
    <article className="flex flex-col gap-3">
      <BookCover media={book.cover} title={book.title} href={`/books/${book.slug}`} />

      <h3 className="text-2xl leading-snug">
        <Link href={`/books/${book.slug}`} className="hover:underline">
          {book.title}
        </Link>
      </h3>

      {book.author && <p className="text-sm text-gray-700">{book.author}</p>}
    </article>
  );
}