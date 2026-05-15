import { cache } from 'react';

import { ONE_HOUR_PAYLOAD_CACHE } from '@/lib/payload/cache';
import { getHomePageShell } from '@/lib/payload/home-page-shell';
import { buildMetadata } from '@/lib/utils/next-metadata';
import { Container } from '@/components/core/container';
import { Layout } from '@/components/core/layout';
import { Categories } from '@/components/shared/categories';
import { Text } from '@/components/shared/text';

export const revalidate = 60;

const getCategoriesPageData = cache(() =>
  getHomePageShell({
    cache: ONE_HOUR_PAYLOAD_CACHE,
  })
);

export async function generateMetadata() {
  const data = await getCategoriesPageData();

  return buildMetadata({
    title: data.homepage?.meta?.title || 'Categories',
    description: data.homepage?.meta?.description || 'Browse all post categories',
    image: data.homepage?.meta?.image?.url || null,
  });
}

export default async function CategoriesPage() {
  const data = await getCategoriesPageData();

  return (
    <Layout>
      <Container className="my-4 w-full md:px-20">
        <div className="mx-auto w-full md:w-2/3">
          <Text text="Categories" />
          <Categories categories={data.allCategories} />
        </div>
      </Container>
    </Layout>
  );
}
