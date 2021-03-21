import Layout from '../components/layout'
import { getDataForHome } from '../apis/index'
import Head from 'next/head'
import { renderMetaTags } from 'react-datocms'
import { useAppContext } from '../context/state';
import { useEffect } from 'react'
import { Placeholder } from '../components/placeholder';

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

export async function getServerSideProps({ preview }) {
  const data = (await getDataForHome(preview)) || []
  return {
    props: data
  }
}
