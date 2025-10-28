import { getDataForHome } from 'common/apis/index';
import { Container } from 'components/core/container';
import { Categories } from 'components/shared/categories';
import { generateHomepageMetaTags } from 'common/utils/meta-tags';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { data } = await getDataForHome({ limit: 0 });
  const allCategories = data.allCategories ?? [];

  return (
    <main className="flex flex-col items-center">
      <div className="mt-16" />
      <Container className="flex flex-col md:flex-row md:px-20">
        <Categories categories={allCategories} />
      </Container>
    </main>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const { data } = await getDataForHome({ limit: 0 });
  const homepage = data.homepage;

  const metaTags = generateHomepageMetaTags(homepage?.meta, {
    title: 'Categories',
    description: 'Browse all post categories',
  });

  const metadata: Metadata = {
    title: metaTags.find((tag) => tag.tag === 'title')?.content || 'Categories',
  };

  const description = metaTags.find(
    (tag) => tag.tag === 'meta' && tag.attributes?.name === 'description'
  )?.attributes?.content;
  if (description) {
    metadata.description = description;
  }

  return metadata;
}
