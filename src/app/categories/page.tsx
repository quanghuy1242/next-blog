import { cache } from 'react';

import { getHomePageShell } from '@/lib/payload/index';
import { buildMetadata } from '@/lib/utils/next-metadata';
import { Container } from '@/components/core/container';
import { Layout } from '@/components/core/layout';
import { NotYetImplemented } from '@/components/core/not-yet-implemented';

export const revalidate = 60;

const getCategoriesPageData = cache(getHomePageShell);

export async function generateMetadata() {
  const data = await getCategoriesPageData();

  return buildMetadata({
    title: data.homepage?.meta?.title || 'Categories',
    description: data.homepage?.meta?.description || 'Browse all post categories',
    image: data.homepage?.meta?.image?.url || null,
  });
}

export default async function CategoriesPage() {
  return (
    <Layout>
      <Container className="flex flex-col md:flex-row md:px-20">
        <NotYetImplemented />
      </Container>
    </Layout>
  );
}
