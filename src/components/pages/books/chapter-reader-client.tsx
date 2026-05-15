'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import type {
  Book,
  BookmarkRecord,
  Chapter,
  CommentsResult,
  ReadingProgressRecord,
} from '@/types/cms';
import { useReadingProgress } from '@/hooks/useReadingProgress';
import { PageSection } from '@/components/layout/page-section';
import { ReaderLayout } from '@/components/layout/reader-layout';
import { ChapterContent } from '@/components/pages/books/chapter-content';
import { ChapterPasswordGate } from '@/components/pages/books/chapter-password-gate';
import { ChapterReaderHeader } from '@/components/pages/books/chapter-reader-header';
import { ChapterReaderNavigation } from '@/components/pages/books/chapter-reader-navigation';
import { mergeReaderProgressForDisplay } from '@/lib/domain/books/progress-maps';
import {
  ChapterReaderTocDrawer,
  ChapterReaderTocSidebar,
} from '@/components/pages/books/chapter-reader-toc';
import { useChapterNavigation } from '@/hooks/books/useChapterNavigation';
import { useChapterViewerState } from '@/hooks/books/useChapterViewerState';
import { useLocalChapterProgress } from '@/hooks/books/useLocalChapterProgress';
import { CommentsSection } from '@/components/shared/comments/CommentsSection';
import { ReadingProgressBar } from '@/components/shared/reading-progress-bar';

interface ChapterReaderClientProps {
  book: Book;
  chapter: Chapter;
  chapters: Chapter[];
  isDraftMode: boolean;
  isAuthenticated: boolean;
  readingProgress: ReadingProgressRecord[];
  initialComments?: CommentsResult | null;
  initialBookmark?: BookmarkRecord | null;
}

/**
 * Reader content should not wait for per-user state.
 *
 * This component now only coordinates reader layout. Viewer-state hydration,
 * local progress hints, TOC controls, and chapter navigation live in focused
 * hooks/components so the page does not turn into the state machine itself.
 */
export function ChapterReaderClient({
  book,
  chapter,
  chapters,
  isAuthenticated,
  readingProgress,
  initialComments = null,
  initialBookmark,
}: ChapterReaderClientProps) {
  const [isTocOpen, setIsTocOpen] = useState(false);
  const chapterContentRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const shouldRenderChapterTitle =
    (book.origin as string) !== 'epub_imported' &&
    (book.sourceType as string) !== 'epub_upload';
  const isChapterLocked = chapter.hasPassword === true && chapter.content == null;
  const openToc = useCallback(() => {
    setIsTocOpen(true);
  }, []);
  const closeToc = useCallback(() => {
    setIsTocOpen(false);
  }, []);
  const handleChapterUnlocked = useCallback(async () => {
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    router.replace(currentUrl || window.location.pathname);
    router.refresh();
  }, [router]);
  const {
    viewerBookmark,
    viewerStateLoaded,
    readingProgressByChapterId,
  } = useChapterViewerState({
    book,
    chapter,
    chapters,
    isAuthenticated,
    initialBookmark,
    initialReadingProgress: readingProgress,
  });
  const localProgressByChapterId = useLocalChapterProgress(book.id, chapters, isAuthenticated);
  const { previousChapter, nextChapter } = useChapterNavigation(chapters, chapter.slug);
  const shouldTrackProgress = isAuthenticated && !isChapterLocked;
  const currentReadingProgress = useReadingProgress({
    chapterId: chapter.id,
    bookId: book.id,
    enabled: shouldTrackProgress,
    targetRef: chapterContentRef,
    initialProgress: readingProgressByChapterId?.[chapter.id] ?? 0,
  });
  const chapterProgressForDisplay = useMemo(
    () => mergeReaderProgressForDisplay({
      chapterId: chapter.id,
      currentReadingProgress,
      localProgressByChapterId,
      serverProgressByChapterId: readingProgressByChapterId,
      shouldTrackProgress,
    }),
    [
      chapter.id,
      currentReadingProgress,
      localProgressByChapterId,
      readingProgressByChapterId,
      shouldTrackProgress,
    ]
  );

  return (
    <PageSection>
      <ReaderLayout
        toc={
          <ChapterReaderTocSidebar
            book={book}
            chapter={chapter}
            chapters={chapters}
            readingProgressByChapterId={chapterProgressForDisplay}
          />
        }
      >
        <ChapterReaderHeader
          book={book}
          chapter={chapter}
          isAuthenticated={isAuthenticated}
          shouldRenderChapterTitle={shouldRenderChapterTitle}
          viewerBookmark={viewerBookmark}
          viewerStateLoaded={viewerStateLoaded}
          onOpenToc={openToc}
        />

        <ReadingProgressBar progress={currentReadingProgress} />

        {isChapterLocked ? (
          <ChapterPasswordGate
            chapterId={chapter.id}
            onUnlocked={handleChapterUnlocked}
          />
        ) : (
          <div ref={chapterContentRef}>
            <ChapterContent
              content={chapter.content}
              bookId={book.id}
              bookSlug={book.slug}
              chapters={chapters}
            />
          </div>
        )}

        {!isChapterLocked ? (
          <CommentsSection
            chapterId={String(chapter.id)}
            initialData={initialComments}
            refreshOnMount={initialComments == null}
          />
        ) : null}

        <ChapterReaderNavigation
          bookId={book.id}
          bookSlug={book.slug}
          previousChapter={previousChapter}
          nextChapter={nextChapter}
        />
      </ReaderLayout>

      <ChapterReaderTocDrawer
        book={book}
        chapter={chapter}
        chapters={chapters}
        isOpen={isTocOpen}
        onClose={closeToc}
        readingProgressByChapterId={chapterProgressForDisplay}
      />
    </PageSection>
  );
}
