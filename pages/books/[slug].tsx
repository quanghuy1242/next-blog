import React from 'react';
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
import { Text } from 'components/shared/text';
import type { Book, Chapter, Homepage } from 'types/cms';

interface BookDetailPageProps {
  book: Book;
  chapters: Chapter[];
  homepage: Pick<Homepage, 'header'> | null;
}

export default function BookDetailPage({
  book,
  chapters,
  homepage,
}: BookDetailPageProps) {
  const metaTags = generateMetaTags({
    title: book.title,
    description: `Read ${book.title} chapter by chapter.`,
    image: book.cover ? getCoverImageUrl(book.cover) : null,
    type: 'article',
  });

  return (
    <Layout header={homepage?.header} className="flex flex-col items-center">
      <Head>{renderMetaTags(metaTags)}</Head>
      <Container className="my-4 w-full md:px-20">
        <div className="mx-auto w-full md:w-2/3">
          <BookHeader book={book} />
          <Text text="Chapters" />
          <ChapterList chapters={chapters} bookId={book.id} bookSlug={book.slug} />
        </div>
      </Container>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps<
  BookDetailPageProps
> = async ({ params, req }) => {
  const slugParam = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const sessionToken = getBetterAuthTokenFromRequest(req);
  const payloadCache = sessionToken ? AUTH_PAYLOAD_CACHE : ONE_HOUR_PAYLOAD_CACHE;

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
    });

    const { book, chapters, homepage } = accessibleResult;

    if (!book || book.slug !== parsedBookRoute.bookSlug) {
      return {
        notFound: true,
      };
    }

    return {
      props: {
        book,
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

  return {
    redirect: {
      destination: buildBookHref(book.id, book.slug),
      permanent: false,
    },
  };
};
