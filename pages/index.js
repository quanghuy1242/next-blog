import { getDataForHome } from 'common/apis/index';
import { Container } from 'components/core/container';
import { Layout } from 'components/core/layout';
import { Banner } from 'components/pages/index/banner';
import { Categories } from 'components/shared/categories';
import { Posts } from 'components/shared/posts';
import { Text } from 'components/shared/text';
import Head from 'next/head';
import { renderMetaTags } from 'react-datocms';

export default function Index({ allPosts, homepage, allCategories }) {
  return (
    <Layout header={homepage.header} className="flex flex-col items-center">
      <Head>{renderMetaTags(homepage.metadata)}</Head>
      <Banner
        header={homepage.header}
        subHeader={homepage.subHeader}
        className="w-full"
      />
      <Container className="flex flex-col md:flex-row md:px-20">
        <div className="flex-grow md:w-2/3 md:mr-6">
          <Text text="Latest Posts" />
          <Posts posts={allPosts} hasMoreCol={false} />
        </div>
        <div className="md:w-1/3">
          <Text text="Categories" />
          <Categories categories={allCategories} />
        </div>
      </Container>
    </Layout>
  );
}

export async function getStaticProps() {
  const data = (await getDataForHome()) || [];
  return {
    props: data,
    revalidate: 60,
  };
}
