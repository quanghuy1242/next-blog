import React from 'react';
import type { Chapter } from 'types/cms';
import { buildChapterHref } from 'common/utils/book-route';
import { SSRPrefetchLink } from 'components/shared/ssr-prefetch-link';
import { ChapterLockBadge } from './chapter-lock-badge';

interface ChapterListProps {
  chapters: Chapter[];
  bookId: number;
  bookSlug: string;
}

export function ChapterList({ chapters, bookId, bookSlug }: ChapterListProps) {
  if (!chapters.length) {
    return <p className="text-sm text-gray-500">No chapters are available yet.</p>;
  }

  return (
    <ol className="space-y-2">
      {chapters.map((chapter) => (
        <li key={`${chapter.slug}-${chapter.order}`}>
          <SSRPrefetchLink
            href={buildChapterHref(bookId, bookSlug, chapter.slug)}
            className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 hover:border-gray-300"
          >
            {/* <span className="mr-4 text-sm text-gray-600">Chapter {chapter.order}</span> */}
            <span className="min-w-0 flex-1 text-sm font-medium text-gray-900">
              {chapter.title}
            </span>
            {chapter.hasPassword ? <ChapterLockBadge className="ml-3" /> : null}
          </SSRPrefetchLink>
        </li>
      ))}
    </ol>
  );
}
