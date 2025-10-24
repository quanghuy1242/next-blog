import { getDataForHome } from 'common/apis/index';
import { Container } from 'components/core/container';
import { Layout } from 'components/core/layout';
import { renderMetaTags } from 'components/core/metadata';
import { generateHomepageMetaTags } from 'common/utils/meta-tags';
import { NotYetImplemented } from 'components/core/not-yet-implemented';
import type { GetStaticProps } from 'next';
import Head from 'next/head';
import type { HomePageData } from 'types/cms';

interface CategoriesPageProps {
  homepage: HomePageData['homepage'];
}

export default function Categories({ homepage }: CategoriesPageProps) {
  const metaTags = generateHomepageMetaTags(homepage?.meta, {
    title: 'Categories',
    description: 'Browse all post categories',
  });

  return (
    <Layout header={homepage?.header}>
      <Head>{renderMetaTags(metaTags)}</Head>
      <Container className="flex flex-col md:flex-row md:px-20">
        <NotYetImplemented />
      </Container>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps<CategoriesPageProps> = async () => {
  const { data } = await getDataForHome();
  return {
    props: {
      homepage: data.homepage ?? null,
    },
    revalidate: 60,
  };
};
