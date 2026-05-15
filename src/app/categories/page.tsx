import { getCategoriesPageData } from '@/lib/server/categories/page-data';
import { buildMetadata } from '@/lib/shared/metadata';
import { PageSection } from '@/components/layout/page-section';
import { PageShell } from '@/components/layout/page-shell';
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
    <PageShell>
      <PageSection width="content">
        <Text text="Categories" />
        <Categories categories={data.allCategories} />
      </PageSection>
    </PageShell>
  );
}
