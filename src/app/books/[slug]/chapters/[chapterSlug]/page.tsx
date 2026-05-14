import { cache } from 'react';

import { Layout } from '@/components/core/layout';
import { ChapterReaderClient } from '@/components/pages/books/chapter-reader-client';
import { getChapterPageMetadata } from '@/lib/metadata/chapter-page';
import { getChapterPageData } from '@/lib/server/books/page-data';

interface ChapterPageProps {
  params: Promise<{ slug: string; chapterSlug: string }>;
}

const getCachedChapterPageData = cache(getChapterPageData);

export async function generateMetadata({ params }: ChapterPageProps) {
  const resolvedParams = await params;
  const data = await getCachedChapterPageData(resolvedParams.slug, resolvedParams.chapterSlug);

  return getChapterPageMetadata(data.book, data.chapter);
}

export default async function ChapterPage({ params }: ChapterPageProps) {
  const resolvedParams = await params;
  const data = await getCachedChapterPageData(resolvedParams.slug, resolvedParams.chapterSlug);

  return (
    <Layout className="flex flex-col items-center" isDraftMode={data.isDraftMode}>
      <ChapterReaderClient {...data} />
    </Layout>
  );
}
