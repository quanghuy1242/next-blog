import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { getBookBySlug, getBookDetailById } from 'common/apis/books';
import { AUTH_PAYLOAD_CACHE, ONE_HOUR_PAYLOAD_CACHE } from 'common/apis/cache';
import { getCoverImageUrl } from 'common/utils/image';
import { generateMetaTags } from 'common/utils/meta-tags';
import { getBetterAuthTokenFromRequest } from 'common/utils/auth';
import { buildBookHref, parseBookRouteSegment } from 'common/utils/book-route';
import { Container } from 'components/core/container';
import { Layout } from 'components/core/layout';
import { renderMetaTags } from 'components/core/metadata';
import { BookHeader } from 'components/pages/books/book-header';
import { ChapterList } from 'components/pages/books/chapter-list';
import { BookmarkButton } from 'components/shared/bookmark-button';
import { SSRPrefetchLink } from 'components/shared/ssr-prefetch-link';
import { Text } from 'components/shared/text';
import type { Book, Chapter, Homepage } from 'types/cms';
import { getReadingProgress } from 'common/apis/reading-progress';
import type { ReadingProgressRecord } from 'types/cms';
import { calculateWholeBookProgress } from 'common/utils/reading-progress';

interface BookDetailPageProps {
  book: Book;
  chapters: Chapter[];
  homepage: Pick<Homepage, 'header'> | null;
  readingProgress: ReadingProgressRecord[];
  continueReadingChapterSlug: string | null;
  isDraftMode: boolean;
  isAuthenticated: boolean;
}

export default function BookDetailPage({
  book,
  chapters,
  homepage,
  readingProgress,
  continueReadingChapterSlug,
  isDraftMode,
  isAuthenticated,
}: BookDetailPageProps) {
  const metaTags = generateMetaTags({
    title: book.title,
    description: `Read ${book.title} chapter by chapter.`,
    image: book.cover ? getCoverImageUrl(book.cover) : null,
    type: 'article',
  });

  const readingProgressByChapterId =
    readingProgress.length > 0
      ? Object.fromEntries(
          readingProgress
            .filter((record) => record.chapterId != null && record.progress != null)
            .map((record) => [Number(record.chapterId!), record.progress!])
        )
      : undefined;

  const wholeBookProgress = calculateWholeBookProgress({
    chapters,
    records: readingProgress,
    totalWordCount: book.totalWordCount,
  });

  return (
    <Layout header={homepage?.header} className="flex flex-col items-center" isDraftMode={isDraftMode}>
      <Head>{renderMetaTags(metaTags)}</Head>
      <Container className="my-4 w-full md:px-20">
        <div className="mx-auto w-full md:w-2/3">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <BookHeader book={book} />
            </div>
            <BookmarkButton
              contentType="book"
              contentId={book.id}
              isAuthenticated={isAuthenticated}
            />
          </div>
          {isAuthenticated || continueReadingChapterSlug ? (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              {isAuthenticated ? (
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm font-medium tabular-nums text-gray-700">
                  Progress: {wholeBookProgress}%
                </span>
              ) : null}
              {continueReadingChapterSlug ? (
                <SSRPrefetchLink
                  href={`${buildBookHref(book.id, book.slug)}/chapters/${continueReadingChapterSlug}`}
                  className="inline-flex items-center gap-2 rounded bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-darkBlue"
                >
                  Continue reading
                </SSRPrefetchLink>
              ) : null}
            </div>
          ) : null}
          <Text text="Chapters" />
          <ChapterList
            chapters={chapters}
            bookId={book.id}
            bookSlug={book.slug}
            readingProgressByChapterId={readingProgressByChapterId}
          />
        </div>
      </Container>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps<
  BookDetailPageProps
> = async ({ params, req, draftMode }) => {
  const slugParam = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const sessionToken = getBetterAuthTokenFromRequest(req);
  const isDraftMode = draftMode === true;
  const payloadCache = isDraftMode
    ? undefined
    : sessionToken
      ? AUTH_PAYLOAD_CACHE
      : ONE_HOUR_PAYLOAD_CACHE;

  if (!slugParam) {
    return {
      notFound: true,
    };
  }

  const parsedBookRoute = parseBookRouteSegment(slugParam);

  if (parsedBookRoute.bookId) {
    const accessibleResult = await getBookDetailById(parsedBookRoute.bookId, {
      authToken: sessionToken,
      cache: payloadCache,
      draftMode: isDraftMode,
    });

    const { book, chapters, homepage } = accessibleResult;

    if (!book || book.slug !== parsedBookRoute.bookSlug) {
      return {
        notFound: true,
      };
    }

    let readingProgress: ReadingProgressRecord[] = [];
    let continueReadingChapterSlug: string | null = null;

    if (sessionToken) {
      try {
        readingProgress = await getReadingProgress(String(book.id), { authToken: sessionToken });
      } catch {
        readingProgress = [];
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
      props: {
        book,
        chapters,
        homepage,
        readingProgress,
        continueReadingChapterSlug,
        isDraftMode,
        isAuthenticated: !!sessionToken,
      },
    };
  }

  const accessibleResult = await getBookBySlug(parsedBookRoute.bookSlug, {
    authToken: sessionToken,
    cache: payloadCache,
    draftMode: isDraftMode,
  });

  const { book } = accessibleResult;

  if (!book) {
    return {
      notFound: true,
    };
  }

  return {
    redirect: {
      destination: buildBookHref(book.id, book.slug),
      permanent: false,
    },
  };
};
