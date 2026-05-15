import React from 'react';
import cn from 'classnames';
import type { Chapter } from '@/types/cms';
import { buildChapterHref } from '@/lib/domain/books/routes';
import { ChapterLockBadge } from './chapter-lock-badge';
import { TextLink } from '@/components/ui/aria/link';
import { Badge } from '@/components/ui/surface/badge';

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
      <ul className="menu space-y-1 p-0">
        {chapters.map((chapter) => {
          const progress = readingProgressByChapterId?.[chapter.id];
          return (
            <li key={`${chapter.slug}-${chapter.order}`}>
              <TextLink
                href={buildChapterHref(bookId, bookSlug, chapter.slug)}
                prefetch={false}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-2 rounded text-sm text-base-content/70 no-underline hover:no-underline',
                  chapter.slug === currentChapterSlug
                    ? 'font-semibold text-base-content'
                    : ''
                )}
              >
                <span className="break-words relative -top-[2px]">{chapter.title}</span>
                {progress != null && progress > 0 ? (
                  <Badge variant="outline" className="shrink-0 text-[11px] font-semibold tabular-nums text-base-content/50">
                    {formatProgress(progress)}
                  </Badge>
                ) : null}
                {chapter.hasPassword ? <ChapterLockBadge compact className="ml-1 align-text-bottom" /> : null}
              </TextLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
