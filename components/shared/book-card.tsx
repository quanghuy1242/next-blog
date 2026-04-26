import React from 'react';
import type { Book } from 'types/cms';
import { buildBookHref } from 'common/utils/book-route';
import { SSRPrefetchLink } from 'components/shared/ssr-prefetch-link';
import { CoverImage } from './cover-image';

interface BookCardProps {
  book: Book;
}

export function BookCard({ book }: BookCardProps) {
  return (
    <article className="flex flex-col gap-2">
      <SSRPrefetchLink href={buildBookHref(book.id, book.slug)} className="block">
        {book.cover ? (
          <CoverImage media={book.cover} title={book.title} className="mb-0" />
        ) : (
          <div className="h-40 w-full rounded-sm bg-gradient-to-br from-blue to-darkBlue shadow-small" />
        )}
      </SSRPrefetchLink>

      <h3 className="text-2xl leading-snug">
        <SSRPrefetchLink href={buildBookHref(book.id, book.slug)} className="hover:underline">
          {book.title}
        </SSRPrefetchLink>
      </h3>

      {book.author && <p className="text-sm text-gray-700">{book.author}</p>}

      <div className="flex flex-wrap gap-1 text-xs">
        <span className="rounded bg-blue px-2 py-1 text-white">{book.origin}</span>
        <span className="rounded bg-gray-200 px-2 py-1 text-gray-700">
          {book.importStatus}
        </span>
        <span className="rounded bg-gray-200 px-2 py-1 text-gray-700">
          {book.syncStatus}
        </span>
      </div>
    </article>
  );
}
