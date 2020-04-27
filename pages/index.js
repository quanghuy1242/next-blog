import Container from '../components/container'
import MoreStories from '../components/more-stories'
import Layout from '../components/layout'
import { getAllPostsForHome } from '../lib/api'
import Head from 'next/head'
import Banner from '../components/banner'
import Header from '../components/header'

export default function Index({ allPosts }) {
  return (
    <Layout>
      <Head>
        <title>Quang Huy Blog</title>
      </Head>
      <Header />
      <Banner />
      <Container>
        <div className="mt-10" />
        <MoreStories posts={allPosts} />
      </Container>
    </Layout>
  )
}

export async function getServerSideProps({ preview }) {
  const allPosts = (await getAllPostsForHome(preview)) || []
  return {
    props: { allPosts }
  }
}
