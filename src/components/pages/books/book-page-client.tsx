'use client';

import { useMemo } from 'react';

import type { Book, Chapter } from '@/types/cms';
import { getContinueReadingChapterSlug } from '@/lib/domain/books/continue-reading';
import { calculateWholeBookProgress } from '@/lib/domain/books/reading-progress';
import { buildBookHref } from '@/lib/domain/books/routes';
import { BookHeader } from '@/components/pages/books/book-header';
import { ChapterList } from '@/components/pages/books/chapter-list';
import {
  mergeProgressByChapterId,
  recordsFromProgressMap,
} from '@/lib/domain/books/progress-maps';
import { useBookDetailViewerState } from '@/hooks/books/useBookDetailViewerState';
import { useLocalChapterProgress } from '@/hooks/books/useLocalChapterProgress';
import { BookmarkButton } from '@/components/shared/bookmark-button';
import { Text } from '@/components/shared/text';
import { ButtonLink } from '@/components/shared/ui/button';

interface BookPageClientProps {
  book: Book;
  chapters: Chapter[];
  isAuthenticated: boolean;
}

/**
 * Hydrates live book viewer state after the server has already rendered content.
 *
 * This is intentionally client-owned: the server route returns the book/chapter shell
 * fast, this component uses the last local snapshot to avoid flicker, then refreshes
 * from `/api/books/viewer-state` for cross-device correctness.
 */
export function BookPageClient({
  book,
  chapters,
  isAuthenticated,
}: BookPageClientProps) {
  const { viewerState, viewerStateLoaded } = useBookDetailViewerState(book.id, isAuthenticated);
  const localProgressByChapterId = useLocalChapterProgress(book.id, chapters, isAuthenticated);

  const readingProgressByChapterId = useMemo(
    () => mergeProgressByChapterId(viewerState?.readingProgressByChapterId, localProgressByChapterId),
    [localProgressByChapterId, viewerState?.readingProgressByChapterId]
  );
  const readingProgressForDisplay = useMemo(
    () => recordsFromProgressMap(readingProgressByChapterId),
    [readingProgressByChapterId]
  );
  const wholeBookProgress = viewerState?.wholeBookProgress
    ?? calculateWholeBookProgress({
      chapters,
      records: readingProgressForDisplay,
      totalWordCount: book.totalWordCount,
    });
  const continueReadingChapterSlug = viewerState?.continueReadingChapterSlug
    ?? getContinueReadingChapterSlug(chapters, readingProgressForDisplay);
  const shouldShowProgress = isAuthenticated && (viewerStateLoaded || wholeBookProgress > 0);

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <BookHeader book={book} />
        </div>
        <BookmarkButton
          contentType="book"
          contentId={book.id}
          isAuthenticated={isAuthenticated}
          initialBookmark={viewerState?.bookmark ?? null}
          initialStateLoaded={viewerStateLoaded}
        />
      </div>
      {shouldShowProgress || continueReadingChapterSlug ? (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {shouldShowProgress ? (
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm font-medium tabular-nums text-gray-700">
              Progress: {wholeBookProgress}%
            </span>
          ) : null}
          {continueReadingChapterSlug ? (
            <ButtonLink
              href={`${buildBookHref(book.id, book.slug)}/chapters/${continueReadingChapterSlug}`}
              size="lg"
              prefetch={false}
            >
              Continue reading
            </ButtonLink>
          ) : null}
        </div>
      ) : null}
      <Text text="Chapters" />
      <ChapterList
        chapters={chapters}
        bookId={book.id}
        bookSlug={book.slug}
        readingProgressByChapterId={
          Object.keys(readingProgressByChapterId).length > 0
            ? readingProgressByChapterId
            : undefined
        }
      />
    </>
  );
}
