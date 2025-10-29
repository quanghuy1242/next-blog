import { getDataForHome } from 'common/apis/index';
import { Container } from 'components/core/container';
import { Categories } from 'components/shared/categories';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { data } = await getDataForHome({ limit: 0 });
  return (
    <Container className="flex flex-col md:flex-row md:px-20">
      <Categories categories={data.allCategories} />
    </Container>
  );
}

export const metadata: Metadata = {
  title: 'Categories',
  description: 'Browse all post categories',
};
