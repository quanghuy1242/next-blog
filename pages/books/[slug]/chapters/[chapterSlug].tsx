import React from 'react';
import { useMemo, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { getBookBySlug } from 'common/apis/books';
import { ONE_HOUR_PAYLOAD_CACHE } from 'common/apis/cache';
import { getChapterByBookAndSlug, getChapterPageByBookId } from 'common/apis/chapters';
import { buildBookHref, buildChapterHref, parseBookRouteSegment } from 'common/utils/book-route';
import { getCoverImageUrl } from 'common/utils/image';
import { generateMetaTags } from 'common/utils/meta-tags';
import { getBetterAuthTokenFromRequest } from 'common/utils/auth';
import { Container } from 'components/core/container';
import { Layout } from 'components/core/layout';
import { renderMetaTags } from 'components/core/metadata';
import { ChapterContent } from 'components/pages/books/chapter-content';
import { ChapterToc } from 'components/pages/books/chapter-toc';
import { ChapterTocDrawer } from 'components/pages/books/chapter-toc-drawer';
import type { Book, Chapter, Homepage } from 'types/cms';

interface ChapterPageProps {
  book: Book;
  chapter: Chapter;
  chapters: Chapter[];
  homepage: Pick<Homepage, 'header'> | null;
}

export default function ChapterPage({
  book,
  chapter,
  chapters,
  homepage,
}: ChapterPageProps) {
  const [isTocOpen, setIsTocOpen] = useState(false);
  const shouldRenderChapterTitle =
    (book.origin as string) !== 'epub_imported' &&
    (book.sourceType as string) !== 'epub_upload';

  const { previousChapter, nextChapter } = useMemo(() => {
    const currentIndex = chapters.findIndex(
      (candidate) => candidate.slug === chapter.slug
    );

    return {
      previousChapter: currentIndex > 0 ? chapters[currentIndex - 1] : null,
      nextChapter:
        currentIndex >= 0 && currentIndex < chapters.length - 1
          ? chapters[currentIndex + 1]
          : null,
    };
  }, [chapter.slug, chapters]);

  const metaTags = generateMetaTags({
    title: `${chapter.title} | ${book.title}`,
    description: `Read ${chapter.title} from ${book.title}.`,
    image: book.cover ? getCoverImageUrl(book.cover) : null,
    type: 'article',
  });

  return (
    <Layout header={homepage?.header} className="flex flex-col items-center">
      <Head>{renderMetaTags(metaTags)}</Head>
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
            />
          </aside>

          <article className="min-w-0 lg:col-span-9 lg:self-start xl:col-span-10">
            <div className="mx-auto max-w-3xl">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    <Link href={buildBookHref(book.id, book.slug)} className="hover:underline">
                      {book.title}
                    </Link>
                  </p>
                  {shouldRenderChapterTitle ? (
                    <h1 className="text-3xl font-bold leading-tight">{chapter.title}</h1>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setIsTocOpen(true)}
                  className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-700 lg:hidden"
                >
                  Table of contents
                </button>
              </div>

              <ChapterContent
                content={chapter.content}
                bookId={book.id}
                bookSlug={book.slug}
                chapters={chapters}
              />

              <div className="mt-8 flex items-center justify-between gap-4 border-t border-gray-200 pt-4 text-sm">
                <div>
                  {previousChapter ? (
                    <Link
                      href={buildChapterHref(book.id, book.slug, previousChapter.slug)}
                      className="text-blue hover:underline"
                    >
                      Previous: {previousChapter.title}
                    </Link>
                  ) : null}
                </div>
                <div className="text-right">
                  {nextChapter ? (
                    <Link
                      href={buildChapterHref(book.id, book.slug, nextChapter.slug)}
                      className="text-blue hover:underline"
                    >
                      Next: {nextChapter.title}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        </div>
      </Container>

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
        />
      </ChapterTocDrawer>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps<ChapterPageProps> = async ({
  params,
  req,
}) => {
  const bookSlug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const chapterSlug = Array.isArray(params?.chapterSlug)
    ? params?.chapterSlug[0]
    : params?.chapterSlug;
  const sessionToken = getBetterAuthTokenFromRequest(req);
  const payloadCache = sessionToken ? undefined : ONE_HOUR_PAYLOAD_CACHE;

  if (!bookSlug || !chapterSlug) {
    return {
      notFound: true,
    };
  }

  const parsedBookRoute = parseBookRouteSegment(bookSlug);

  if (parsedBookRoute.bookId) {
    const accessibleResult = await getChapterPageByBookId(parsedBookRoute.bookId, chapterSlug, {
      authToken: sessionToken,
      cache: payloadCache,
    });

    const { book, chapter, chapters, homepage } = accessibleResult;

    if (!book || !chapter || book.slug !== parsedBookRoute.bookSlug) {
      return {
        notFound: true,
      };
    }

    return {
      props: {
        book,
        chapter,
        chapters,
        homepage,
      },
    };
  }

  const accessibleResult = await getBookBySlug(parsedBookRoute.bookSlug, {
    authToken: sessionToken,
    cache: payloadCache,
  });

  const { book } = accessibleResult;

  if (!book) {
    return {
      notFound: true,
    };
  }

  const chapterData = await getChapterByBookAndSlug(book.id, chapterSlug, {
    authToken: sessionToken,
    cache: payloadCache,
  });

  if (!chapterData.chapter) {
    return {
      notFound: true,
    };
  }

  return {
    redirect: {
      destination: buildChapterHref(book.id, book.slug, chapterData.chapter.slug),
      permanent: false,
    },
  };
};
