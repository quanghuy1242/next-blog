import { getHomePageData } from '@/lib/server/home/page-data';
import { buildMetadata } from '@/lib/shared/metadata';
import { PageShell } from '@/components/layout/page-shell';
import { HomePageClient } from '@/components/pages/index/home-page-client';

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: HomePageProps) {
  const data = await getHomePageData(await searchParams);

  return buildMetadata({
    title: data.homepage?.meta?.title || data.homepage?.header || 'Blog',
    description: data.homepage?.meta?.description || data.homepage?.subHeader || '',
    image: data.homepage?.meta?.image?.url || null,
  });
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const data = await getHomePageData(await searchParams);

  return (
    <PageShell className="flex flex-col items-center">
      <HomePageClient {...data} />
    </PageShell>
  );
}
