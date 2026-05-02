import React from 'react';
import type { Book } from 'types/cms';
import { buildBookHref } from 'common/utils/book-route';
import { BookCover } from './book-cover';
import { SSRPrefetchLink } from 'components/shared/ssr-prefetch-link';
import { useBookmark } from 'hooks/useBookmark';

interface BookItemProps {
  book: Book;
  isBookmarked?: boolean;
  isAuthenticated?: boolean;
}

export function BookItem({
  book,
  isBookmarked = false,
  isAuthenticated = false,
}: BookItemProps) {
  const { isBookmarked: isBookmarkedFromApi } = useBookmark({
    contentType: 'book',
    contentId: book.id,
    enabled: isAuthenticated,
  });
  const showBookmarkBadge = isAuthenticated
    ? isBookmarked || isBookmarkedFromApi
    : false;

  return (
    <article className="flex w-40 flex-none flex-col gap-2 sm:w-48">
      <BookCover
        media={book.cover}
        title={book.title}
        href={buildBookHref(book.id, book.slug)}
        className="w-full"
        isBookmarked={showBookmarkBadge}
      />

      <h3 className="text-sm font-medium leading-snug sm:text-base">
        <SSRPrefetchLink href={buildBookHref(book.id, book.slug)} className="hover:underline">
          {book.title}
        </SSRPrefetchLink>
      </h3>

      {book.author && <p className="text-xs text-gray-700">{book.author}</p>}
    </article>
  );
}
