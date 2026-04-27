import React from 'react';
import cn from 'classnames';
import type { Chapter } from 'types/cms';
import { buildChapterHref } from 'common/utils/book-route';
import { SSRPrefetchLink } from 'components/shared/ssr-prefetch-link';
import { ChapterLockBadge } from './chapter-lock-badge';

interface ChapterTocProps {
  chapters: Chapter[];
  bookId: number;
  bookSlug: string;
  currentChapterSlug: string;
  onNavigate?: () => void;
}

export function ChapterToc({
  chapters,
  bookId,
  bookSlug,
  currentChapterSlug,
  onNavigate,
}: ChapterTocProps) {
  return (
    <nav aria-label="Chapter table of contents">
      <ul className="space-y-2">
        {chapters.map((chapter) => (
          <li key={`${chapter.slug}-${chapter.order}`}>
            <SSRPrefetchLink
              href={buildChapterHref(bookId, bookSlug, chapter.slug)}
              onClick={onNavigate}
              className={cn(
                'flex items-center justify-between gap-3 text-sm text-gray-700 hover:underline',
                chapter.slug === currentChapterSlug
                  ? 'font-semibold text-gray-900'
                  : ''
              )}
            >
              <span className="min-w-0 flex-1">{chapter.title}</span>
              {chapter.hasPassword ? <ChapterLockBadge /> : null}
            </SSRPrefetchLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
