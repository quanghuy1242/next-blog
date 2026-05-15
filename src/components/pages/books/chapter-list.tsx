import React from 'react';
import type { Chapter } from '@/types/cms';
import { buildChapterHref } from '@/lib/domain/books/routes';
import { ChapterLockBadge } from './chapter-lock-badge';
import { TextLink } from '@/components/ui/aria/link';
import { Badge } from '@/components/ui/surface/badge';

interface ChapterListProps {
  chapters: Chapter[];
  bookId: number;
  bookSlug: string;
  readingProgressByChapterId?: Record<number, number>;
}

function formatProgress(progress: number): string {
  return `${Math.min(Math.max(Math.round(progress), 0), 100)}%`;
}

export function ChapterList({ chapters, bookId, bookSlug, readingProgressByChapterId }: ChapterListProps) {
  if (!chapters.length) {
    return <p className="text-sm text-gray-500">No chapters are available yet.</p>;
  }

  return (
    <ol className="space-y-2">
      {chapters.map((chapter) => {
        const progress = readingProgressByChapterId?.[chapter.id];
        return (
          <li key={`${chapter.slug}-${chapter.order}`}>
            <TextLink
              href={buildChapterHref(bookId, bookSlug, chapter.slug)}
              prefetch={false}
              className="flex items-center justify-between rounded border border-base-300 px-3 py-2 text-base-content no-underline hover:border-base-content/30 hover:no-underline"
            >
              <span className="min-w-0 flex-1 text-sm font-medium text-gray-900">
                {chapter.title}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {progress != null && progress > 0 ? (
                  <Badge variant="outline" className="text-xs font-semibold tabular-nums text-base-content/60">
                    {formatProgress(progress)}
                  </Badge>
                ) : null}
                {chapter.hasPassword ? <ChapterLockBadge className="ml-3" /> : null}
              </span>
            </TextLink>
          </li>
        );
      })}
    </ol>
  );
}
