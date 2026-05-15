'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import type {
  Book,
  BookmarkRecord,
  Chapter,
  CommentsResult,
  ReadingProgressRecord,
} from '@/types/cms';
import {
  READING_POSITION_CHANGE_EVENT,
  readReadingProgressByChapterId,
} from '@/lib/browser/reading-position';
import { buildBookHref, buildChapterHref } from '@/lib/routes/book-route';
import { useReadingProgress } from '@/hooks/useReadingProgress';
import { Container } from '@/components/core/container';
import { ChapterContent } from '@/components/pages/books/chapter-content';
import { ChapterPasswordGate } from '@/components/pages/books/chapter-password-gate';
import { ChapterToc } from '@/components/pages/books/chapter-toc';
import { ChapterTocDrawer } from '@/components/pages/books/chapter-toc-drawer';
import { BookmarkButton } from '@/components/shared/bookmark-button';
import { CommentsSection } from '@/components/shared/comments/CommentsSection';
import { ReadingProgressBar } from '@/components/shared/reading-progress-bar';
import { Button } from '@/components/shared/ui/button';
import { TextLink } from '@/components/shared/ui/text-link';

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
  const [viewerBookmark, setViewerBookmark] = useState<BookmarkRecord | null>(initialBookmark ?? null);
  const [viewerReadingProgress, setViewerReadingProgress] = useState<ReadingProgressRecord[]>(readingProgress);
  const [viewerStateLoaded, setViewerStateLoaded] = useState(!isAuthenticated || initialBookmark !== undefined);
  const [localProgressByChapterId, setLocalProgressByChapterId] = useState<Record<number, number>>({});
  const chapterContentRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const shouldRenderChapterTitle =
    (book.origin as string) !== 'epub_imported' &&
    (book.sourceType as string) !== 'epub_upload';
  const isChapterLocked = chapter.hasPassword === true && chapter.content == null;
  const readingProgressByChapterId = useMemo(
    () =>
      viewerReadingProgress.length > 0
        ? Object.fromEntries(
            viewerReadingProgress
              .filter((r) => r.chapterId != null && r.progress != null)
              .map((r) => [Number(r.chapterId!), r.progress!])
          )
        : undefined,
    [viewerReadingProgress]
  );
  useEffect(() => {
    setViewerBookmark(initialBookmark ?? null);
    setViewerReadingProgress(readingProgress);
    setViewerStateLoaded(!isAuthenticated || initialBookmark !== undefined);
  }, [initialBookmark, isAuthenticated, readingProgress]);
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const controller = new AbortController();

    setViewerStateLoaded(false);

    async function loadViewerState() {
      try {
        const params = new URLSearchParams({
          bookId: String(book.id),
          chapterId: String(chapter.id),
        });
        const response = await fetch(`/api/chapters/viewer-state?${params.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as {
          bookmark?: BookmarkRecord | null;
          readingProgress?: ReadingProgressRecord[];
        };

        setViewerBookmark(payload.bookmark ?? null);
        setViewerReadingProgress(payload.readingProgress ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Failed to load chapter viewer state', error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setViewerStateLoaded(true);
        }
      }
    }

    void loadViewerState();

    return () => {
      controller.abort();
    };
  }, [book.id, chapter.id, isAuthenticated]);
  useEffect(() => {
    function syncLocalProgress() {
      setLocalProgressByChapterId(readReadingProgressByChapterId(book.id, chapters));
    }

    syncLocalProgress();
    window.addEventListener(READING_POSITION_CHANGE_EVENT, syncLocalProgress);

    return () => {
      window.removeEventListener(READING_POSITION_CHANGE_EVENT, syncLocalProgress);
    };
  }, [book.id, chapter.id, chapters]);
  const { previousChapter, nextChapter } = useMemo(() => {
    const currentIndex = chapters.findIndex((candidate) => candidate.slug === chapter.slug);

    return {
      previousChapter: currentIndex > 0 ? chapters[currentIndex - 1] : null,
      nextChapter:
        currentIndex >= 0 && currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null,
    };
  }, [chapter.slug, chapters]);
  const shouldTrackProgress = isAuthenticated && !isChapterLocked;
  const currentReadingProgress = useReadingProgress({
    chapterId: chapter.id,
    bookId: book.id,
    enabled: shouldTrackProgress,
    targetRef: chapterContentRef,
    initialProgress: readingProgressByChapterId?.[chapter.id] ?? 0,
  });
  const chapterProgressForDisplay = useMemo(
    () => ({
      ...(readingProgressByChapterId ?? {}),
      ...Object.fromEntries(
        Object.entries(localProgressByChapterId).map(([chapterId, localProgress]) => [
          chapterId,
          Math.max(
            readingProgressByChapterId?.[Number(chapterId)] ?? 0,
            localProgress
          ),
        ])
      ),
      [chapter.id]: shouldTrackProgress
        ? currentReadingProgress
        : (readingProgressByChapterId?.[chapter.id] ?? 0),
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
    <Container className="my-4 w-full md:px-20">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start lg:gap-10">
        <aside
          className="hidden lg:sticky lg:top-20 lg:col-span-3 lg:block lg:self-start lg:overflow-y-auto xl:col-span-2"
          style={{ maxHeight: 'calc(100vh - 6rem)' }}
        >
          <p className="mb-3 text-sm font-semibold text-gray-900">Chapters</p>
          <ChapterToc
            chapters={chapters}
            bookId={book.id}
            bookSlug={book.slug}
            currentChapterSlug={chapter.slug}
            readingProgressByChapterId={chapterProgressForDisplay}
          />
        </aside>

        <article className="min-w-0 lg:col-span-9 lg:self-start xl:col-span-10">
          <div className="mx-auto max-w-3xl">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <nav aria-label="Breadcrumb" className="mb-2">
                  <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-gray-500 sm:text-sm">
                    <li>
                      <TextLink href="/books" medium>
                        Books
                      </TextLink>
                    </li>
                    <li aria-hidden="true" className="text-gray-400">
                      &gt;
                    </li>
                    <li className="min-w-0">
                      <TextLink
                        href={buildBookHref(book.id, book.slug)}
                        className="break-words"
                        medium
                        prefetch={false}
                      >
                        {book.title}
                      </TextLink>
                    </li>
                    <li aria-hidden="true" className="text-gray-400">
                      &gt;
                    </li>
                    <li className="min-w-0 break-words text-gray-500">{chapter.title}</li>
                  </ol>
                </nav>
                {shouldRenderChapterTitle ? (
                  <h1 className="text-3xl font-bold leading-tight">{chapter.title}</h1>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2 self-start">
                <Button
                  type="button"
                  onClick={() => setIsTocOpen(true)}
                  variant="secondary"
                  className="gap-2 px-3 lg:hidden"
                >
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-gray-500">
                    <circle cx="3.5" cy="5" r="1.25" fill="currentColor" />
                    <circle cx="3.5" cy="10" r="1.25" fill="currentColor" />
                    <circle cx="3.5" cy="15" r="1.25" fill="currentColor" />
                    <path
                      d="M7 5h9M7 10h9M7 15h9"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>Table of contents</span>
                </Button>
                <BookmarkButton
                  contentType="chapter"
                  contentId={chapter.id}
                  isAuthenticated={isAuthenticated}
                  initialBookmark={viewerBookmark}
                  initialStateLoaded={viewerStateLoaded}
                />
              </div>
            </div>

            <ReadingProgressBar progress={currentReadingProgress} />

            {isChapterLocked ? (
              <ChapterPasswordGate
                chapterId={chapter.id}
                onUnlocked={async () => {
                  const currentUrl = `${window.location.pathname}${window.location.search}`;
                  router.replace(currentUrl || window.location.pathname);
                  router.refresh();
                }}
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

            <div className="mt-8 flex items-center justify-between gap-4 border-t border-gray-200 pt-4 text-sm">
              <div>
                {previousChapter ? (
                  <TextLink
                    href={buildChapterHref(book.id, book.slug, previousChapter.slug)}
                    prefetch={false}
                  >
                    Previous: {previousChapter.title}
                  </TextLink>
                ) : null}
              </div>
              <div className="text-right">
                {nextChapter ? (
                  <TextLink
                    href={buildChapterHref(book.id, book.slug, nextChapter.slug)}
                    prefetch={false}
                  >
                    Next: {nextChapter.title}
                  </TextLink>
                ) : null}
              </div>
            </div>
          </div>
        </article>
      </div>

      <ChapterTocDrawer
        isOpen={isTocOpen}
        onClose={() => {
          setIsTocOpen(false);
        }}
      >
        <ChapterToc
          chapters={chapters}
          bookId={book.id}
          bookSlug={book.slug}
          currentChapterSlug={chapter.slug}
          onNavigate={() => {
            setIsTocOpen(false);
          }}
          readingProgressByChapterId={chapterProgressForDisplay}
        />
      </ChapterTocDrawer>
    </Container>
  );
}
