import { getDataForHome } from 'common/apis/index';
import { Container } from 'components/core/container';
import { Layout } from 'components/core/layout';
import { NotYetImplemented } from 'components/core/not-yet-implemented';
import Head from 'next/head';
import { renderMetaTags } from 'react-datocms';

export default function Index({ homepage = {} }) {
  return (
    <Layout>
      <Head>{renderMetaTags(homepage?.metadata || [])}</Head>
      <Container className="flex flex-col md:flex-row md:px-20">
        <NotYetImplemented />
      </Container>
    </Layout>
  );
}

export async function getStaticProps() {
  const apiData = (await getDataForHome()) || {}; // Ensure data is an object
  return {
    props: {
      homepage: apiData.homepage || {},
    },
    revalidate: 60,
  };
}
