import Container from '../components/container'
import MoreStories from '../components/more-stories'
import Layout from '../components/layout'
import { getAllPostsForHome } from '../lib/api'
import Head from 'next/head'
import Banner from '../components/banner'
import CoverImage from '../components/cover-image'

export default function Index({ allPosts }) {
  return (
    <Layout>
      <Head>
        <title>Quang Huy Blog</title>
      </Head>
      <Banner />
      <Container>
        <div className="mt-10 flex md:flex-row flex-col md:px-20">
          <div className="flex-grow md:w-2/3 md:mr-6">
            <MoreStories posts={allPosts} hasMoreCol={false} />
          </div>
          <div className="md:w-1/3">
            <CoverImage responsiveImage={allPosts[2].coverImage.responsiveImage} />
          </div>
        </div>
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
