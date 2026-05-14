import { draftMode } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';

import { Container } from '@/components/core/container';
import { Layout } from '@/components/core/layout';
import { BookHeader } from '@/components/pages/books/book-header';
import { ChapterList } from '@/components/pages/books/chapter-list';
import { BookmarkButton } from '@/components/shared/bookmark-button';
import { Text } from '@/components/shared/text';
import { ButtonLink } from '@/components/shared/ui/button';
import { getBookmarks } from '@/lib/payload/bookmarks';
import { getBookBySlug, getBookDetailById } from '@/lib/payload/books';
import { AUTH_PAYLOAD_CACHE, ONE_HOUR_PAYLOAD_CACHE } from '@/lib/payload/cache';
import { getReadingProgress } from '@/lib/payload/reading-progress';
import { calculateWholeBookProgress } from '@/lib/reading/reading-progress';
import { buildBookHref } from '@/lib/routes/book-route';
import { parseBookRouteSegment } from '@/lib/routes/book-route';
import { getAuthTokenFromAppRequest } from '@/lib/server/app-request';
import { getCoverImageUrl } from '@/lib/utils/image';
import { buildMetadata } from '@/lib/utils/next-metadata';
import type { BookmarkRecord, ReadingProgressRecord } from '@/types/cms';

interface BookPageProps {
  params: Promise<{ slug: string }>;
}

async function loadBookPageData(slugParam: string) {
  const sessionToken = await getAuthTokenFromAppRequest();
  const preview = await draftMode();
  const isDraftMode = preview.isEnabled;
  const payloadCache = isDraftMode
    ? undefined
    : sessionToken
      ? AUTH_PAYLOAD_CACHE
      : ONE_HOUR_PAYLOAD_CACHE;
  const parsedBookRoute = parseBookRouteSegment(slugParam);

  if (parsedBookRoute.bookId) {
    const accessibleResult = await getBookDetailById(parsedBookRoute.bookId, {
      authToken: sessionToken,
      cache: payloadCache,
      draftMode: isDraftMode,
    });
    const { book, chapters, homepage } = accessibleResult;

    if (!book || book.slug !== parsedBookRoute.bookSlug) {
      notFound();
    }

    let readingProgress: ReadingProgressRecord[] = [];
    let continueReadingChapterSlug: string | null = null;
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
          contentType: 'book',
          contentId: String(book.id),
          limit: 1,
        });
        initialBookmark = bookmarkResult.docs[0] ?? null;
      } catch {
        initialBookmark = null;
      }

      const chapterSlugs = new Map(chapters.map((c) => [c.id, c.slug]));
      const incompleteProgress = readingProgress
        .filter((r) => r.chapterId != null && r.progress != null && r.progress < 95)
        .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));

      for (const record of incompleteProgress) {
        const chapterId = Number(record.chapterId);
        const slug = chapterSlugs.get(chapterId);

        if (slug) {
          continueReadingChapterSlug = slug;
          break;
        }
      }
    }

    return {
      book,
      chapters,
      continueReadingChapterSlug,
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

  redirect(buildBookHref(accessibleResult.book.id, accessibleResult.book.slug));
}

const getCachedBookPageData = cache(loadBookPageData);

export async function generateMetadata({ params }: BookPageProps) {
  const { book } = await getCachedBookPageData((await params).slug);

  return buildMetadata({
    title: book.title,
    description: `Read ${book.title} chapter by chapter.`,
    image: book.cover ? getCoverImageUrl(book.cover) : null,
    type: 'article',
  });
}

export default async function BookPage({ params }: BookPageProps) {
  const data = await getCachedBookPageData((await params).slug);
  const readingProgressByChapterId =
    data.readingProgress.length > 0
      ? Object.fromEntries(
          data.readingProgress
            .filter((record) => record.chapterId != null && record.progress != null)
            .map((record) => [Number(record.chapterId!), record.progress!])
        )
      : undefined;
  const wholeBookProgress = calculateWholeBookProgress({
    chapters: data.chapters,
    records: data.readingProgress,
    totalWordCount: data.book.totalWordCount,
  });

  return (
    <Layout className="flex flex-col items-center" isDraftMode={data.isDraftMode}>
      <Container className="my-4 w-full md:px-20">
        <div className="mx-auto w-full md:w-2/3">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <BookHeader book={data.book} />
            </div>
            <BookmarkButton
              contentType="book"
              contentId={data.book.id}
              isAuthenticated={data.isAuthenticated}
              initialBookmark={data.initialBookmark}
            />
          </div>
          {data.isAuthenticated || data.continueReadingChapterSlug ? (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              {data.isAuthenticated ? (
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm font-medium tabular-nums text-gray-700">
                  Progress: {wholeBookProgress}%
                </span>
              ) : null}
              {data.continueReadingChapterSlug ? (
                <ButtonLink
                  href={`${buildBookHref(data.book.id, data.book.slug)}/chapters/${data.continueReadingChapterSlug}`}
                  size="lg"
                  ssrPrefetch
                >
                  Continue reading
                </ButtonLink>
              ) : null}
            </div>
          ) : null}
          <Text text="Chapters" />
          <ChapterList
            chapters={data.chapters}
            bookId={data.book.id}
            bookSlug={data.book.slug}
            readingProgressByChapterId={readingProgressByChapterId}
          />
        </div>
      </Container>
    </Layout>
  );
}
