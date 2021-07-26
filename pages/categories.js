import { getDataForHome } from 'common/apis/index';
import Layout from 'components/layout';
import { Placeholder } from 'components/placeholder';
import { useAppContext } from 'context/state';
import Head from 'next/head';
import { useEffect } from 'react';
import { renderMetaTags } from 'react-datocms';

export default function Categories({ allPosts, homepage, allCategories, author }) {
  const { changeHeader } = useAppContext()

  useEffect(() => {
    changeHeader(homepage.header);
  }, [homepage])

  return (
    <Layout>
      <Head>
        {renderMetaTags(homepage.metadata)}
      </Head>
      <Placeholder />
    </Layout>
  )
}

export async function getStaticProps() {
  const data = (await getDataForHome()) || []
  return {
    props: data,
    revalidate: 60
  }
}
