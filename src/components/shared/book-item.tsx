import React from 'react';
import type { Book } from '@/types/cms';
import { buildBookHref } from '@/lib/domain/books/routes';
import { BookCover } from './book-cover';
import { TextLink } from '@/components/ui/aria/link';

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
        <TextLink href={buildBookHref(book.id, book.slug)} prefetch={false} className="text-base-content">
          {book.title}
        </TextLink>
      </h3>

      {book.author && <p className="text-xs text-gray-700">{book.author}</p>}
    </article>
  );
}
