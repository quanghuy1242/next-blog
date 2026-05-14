import React from 'react';
import Link from 'next/link';
import cn from 'classnames';
import type { Chapter } from '@/types/cms';
import { buildChapterHref } from '@/lib/routes/book-route';
import { ChapterLockBadge } from './chapter-lock-badge';

interface ChapterTocProps {
  chapters: Chapter[];
  bookId: number;
  bookSlug: string;
  currentChapterSlug: string;
  onNavigate?: () => void;
  readingProgressByChapterId?: Record<number, number>;
}

function formatProgress(progress: number): string {
  return `${Math.min(Math.max(Math.round(progress), 0), 100)}%`;
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
              <Link
                href={buildChapterHref(bookId, bookSlug, chapter.slug)}
                prefetch={false}
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
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-gray-400">
                    {formatProgress(progress)}
                  </span>
                ) : null}
                {chapter.hasPassword ? <ChapterLockBadge compact className="ml-1 align-text-bottom" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
