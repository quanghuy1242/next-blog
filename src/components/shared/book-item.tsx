import React from 'react';
import Link from 'next/link';
import type { Book } from '@/types/cms';
import { buildBookHref } from '@/lib/routes/book-route';
import { BookCover } from './book-cover';

interface BookItemProps {
  book: Book;
  isAuthenticated?: boolean;
}

export function BookItem({
  book,
  isAuthenticated = false,
}: BookItemProps) {
  const showBookmarkBadge = isAuthenticated && book.isBookmarked === true;

  return (
    <article className="flex w-40 flex-none flex-col gap-2 sm:w-48">
      <BookCover
        media={book.cover}
        title={book.title}
        href={buildBookHref(book.id, book.slug)}
        className="w-full"
        isBookmarked={showBookmarkBadge}
        readingProgressPct={book.readingProgressPct}
      />

      <h3 className="text-sm font-medium leading-snug sm:text-base">
        <Link href={buildBookHref(book.id, book.slug)} prefetch={false} className="hover:underline">
          {book.title}
        </Link>
      </h3>

      {book.author && <p className="text-xs text-gray-700">{book.author}</p>}
    </article>
  );
}
