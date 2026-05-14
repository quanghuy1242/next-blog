import { draftMode } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { Layout } from '@/components/core/layout';
import {
  ChapterReaderClient,
  getChapterPageMetadata,
} from '@/components/pages/books/chapter-reader-client';
import { getBookmarks } from '@/lib/payload/bookmarks';
import { getBookBySlug } from '@/lib/payload/books';
import { AUTH_PAYLOAD_CACHE, ONE_HOUR_PAYLOAD_CACHE } from '@/lib/payload/cache';
import { getChapterByBookAndSlug, getChapterPageByBookId } from '@/lib/payload/chapters';
import { getReadingProgress } from '@/lib/payload/reading-progress';
import { buildChapterHref, parseBookRouteSegment } from '@/lib/routes/book-route';
import { getAuthTokenFromAppRequest, getChapterProofFromAppRequest } from '@/lib/server/app-request';
import type { BookmarkRecord, ReadingProgressRecord } from '@/types/cms';

interface ChapterPageProps {
  params: Promise<{ slug: string; chapterSlug: string }>;
}

async function loadChapterPageData(bookSlug: string, chapterSlug: string) {
  const parsedBookRoute = parseBookRouteSegment(bookSlug);
  const sessionToken = await getAuthTokenFromAppRequest();
  const preview = await draftMode();
  const isDraftMode = preview.isEnabled;
  const chapterPasswordProof =
    !isDraftMode && !sessionToken ? await getChapterProofFromAppRequest() : null;
  const payloadCache = isDraftMode
    ? undefined
    : sessionToken || chapterPasswordProof
      ? AUTH_PAYLOAD_CACHE
      : ONE_HOUR_PAYLOAD_CACHE;

  if (parsedBookRoute.bookId) {
    const accessibleResult = await getChapterPageByBookId(parsedBookRoute.bookId, chapterSlug, {
      authToken: sessionToken,
      cache: payloadCache,
      chapterPasswordProof,
      draftMode: isDraftMode,
    });
    const { book, chapter, chapters, homepage } = accessibleResult;

    if (!book || !chapter || book.slug !== parsedBookRoute.bookSlug) {
      notFound();
    }

    let readingProgress: ReadingProgressRecord[] = [];
    let initialBookmark: BookmarkRecord | null = null;

    if (sessionToken) {
      try {
        readingProgress = await getReadingProgress(String(book.id), { authToken: sessionToken });
      } catch {
        readingProgress = [];
      }

      try {
        const bookmarkResult = await getBookmarks({
          authToken: sessionToken,
          contentType: 'chapter',
          contentId: String(chapter.id),
          limit: 1,
        });
        initialBookmark = bookmarkResult.docs[0] ?? null;
      } catch {
        initialBookmark = null;
      }
    }

    return {
      book,
      chapter,
      chapters,
      homepage,
      initialBookmark,
      isAuthenticated: Boolean(sessionToken),
      isDraftMode,
      readingProgress,
    };
  }

  const accessibleResult = await getBookBySlug(parsedBookRoute.bookSlug, {
    authToken: sessionToken,
    cache: payloadCache,
    draftMode: isDraftMode,
  });

  if (!accessibleResult.book) {
    notFound();
  }

  const chapterData = await getChapterByBookAndSlug(accessibleResult.book.id, chapterSlug, {
    authToken: sessionToken,
    cache: payloadCache,
    chapterPasswordProof,
    draftMode: isDraftMode,
  });

  if (!chapterData.chapter) {
    notFound();
  }

  redirect(buildChapterHref(accessibleResult.book.id, accessibleResult.book.slug, chapterData.chapter.slug));
}

export async function generateMetadata({ params }: ChapterPageProps) {
  const resolvedParams = await params;
  const data = await loadChapterPageData(resolvedParams.slug, resolvedParams.chapterSlug);

  return getChapterPageMetadata(data.book, data.chapter);
}

export default async function ChapterPage({ params }: ChapterPageProps) {
  const resolvedParams = await params;
  const data = await loadChapterPageData(resolvedParams.slug, resolvedParams.chapterSlug);

  return (
    <Layout
      header={data.homepage?.header}
      className="flex flex-col items-center"
      isAuthenticated={data.isAuthenticated}
      isDraftMode={data.isDraftMode}
    >
      <ChapterReaderClient {...data} />
    </Layout>
  );
}
