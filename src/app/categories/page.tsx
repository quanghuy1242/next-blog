import { getCategoriesPageData } from '@/lib/server/categories/page-data';
import { buildMetadata } from '@/lib/shared/metadata';
import { Container } from '@/components/core/container';
import { Layout } from '@/components/core/layout';
import { Categories } from '@/components/shared/categories';
import { Text } from '@/components/shared/text';

export const revalidate = 60;

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
