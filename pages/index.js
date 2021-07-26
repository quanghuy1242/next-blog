import { getDataForHome } from 'common/apis/index'
import About from 'components/about'
import Banner from 'components/banner'
import CategoryPanel from 'components/category-panel'
import Container from 'components/container'
import Layout from 'components/layout'
import MoreStories from 'components/more-stories'
import Title from 'components/title'
import { useAppContext } from 'context/state'
import Head from 'next/head'
import { useEffect } from 'react'
import { renderMetaTags } from 'react-datocms'

export default function Index({ allPosts, homepage, allCategories, author }) {
  const { changeHeader } = useAppContext();

  useEffect(() => {
    changeHeader(homepage.header);
  }, [homepage])

  return (
    <Layout>
      <Head>
        {renderMetaTags(homepage.metadata)}
      </Head>
      <Banner header={homepage.header} subHeader={homepage.subHeader} />
      <Container>
        <div className="my-2 flex md:flex-row flex-col md:px-20">
          <div className="flex-grow md:w-2/3 md:mr-6">
            <Title text="Latest Posts" />
            <MoreStories posts={allPosts} hasMoreCol={false} />
          </div>
          <div className="md:w-1/3">
            <CategoryPanel categories={allCategories} />
            <About
              displayName={author.displayName}
              picture={author.picture}
              description={author.description}
            />
          </div>
        </div>
      </Container>
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
