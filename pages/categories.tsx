import { getDataForHome } from 'common/apis/index';
import { Container } from 'components/core/container';
import { Layout } from 'components/core/layout';
import { NotYetImplemented } from 'components/core/not-yet-implemented';
import type { GetStaticProps } from 'next';
import Head from 'next/head';
import { renderMetaTags } from 'react-datocms';
import type { HomePageData } from 'types/datocms';

interface CategoriesPageProps {
  homepage: HomePageData['homepage'];
}

export default function Categories({ homepage }: CategoriesPageProps) {
  return (
    <Layout header={homepage?.header}>
      <Head>{renderMetaTags(homepage?.metadata || [])}</Head>
      <Container className="flex flex-col md:flex-row md:px-20">
        <NotYetImplemented />
      </Container>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps<CategoriesPageProps> = async () => {
  const data = await getDataForHome();
  return {
    props: {
      homepage: data.homepage ?? null,
    },
    revalidate: 60,
  };
};
