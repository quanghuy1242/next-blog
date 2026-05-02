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
  readingProgressByChapterId?: Record<number, number>;
}

export function ChapterToc({
  chapters,
  bookId,
  bookSlug,
  currentChapterSlug,
  onNavigate,
  readingProgressByChapterId,
}: ChapterTocProps) {
  return (
    <nav aria-label="Chapter table of contents">
      <ul className="space-y-2">
        {chapters.map((chapter) => {
          const progress = readingProgressByChapterId?.[chapter.id];
          return (
            <li key={`${chapter.slug}-${chapter.order}`}>
              <SSRPrefetchLink
                href={buildChapterHref(bookId, bookSlug, chapter.slug)}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-2 text-sm text-gray-700 hover:underline',
                  chapter.slug === currentChapterSlug
                    ? 'font-semibold text-gray-900'
                    : ''
                )}
              >
                <span className="break-words relative -top-[2px]">{chapter.title}</span>
                {progress != null && progress > 0 ? (
                  <span className="inline-flex h-1.5 w-8 shrink-0 overflow-hidden rounded-full bg-gray-200">
                    <span
                      className="h-full bg-blue-500"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </span>
                ) : null}
                {chapter.hasPassword ? <ChapterLockBadge compact className="ml-1 align-text-bottom" /> : null}
              </SSRPrefetchLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}