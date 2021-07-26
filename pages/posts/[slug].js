import { getDataForPostSlug } from 'common/apis/posts.slug'
import markdownToHtml from 'common/markdownToHtml'
import Container from 'components/container'
import Layout from 'components/layout'
import MoreStories from 'components/more-stories'
import PostBody from 'components/post-body'
import PostHeader from 'components/post-header'
import SectionSeparator from 'components/section-separator'
import ErrorPage from 'next/error'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { renderMetaTags } from 'react-datocms'

export default function Post({ post, morePosts }) {
  const router = useRouter()
  if (!router.isFallback && !post?.slug) {
    return <ErrorPage statusCode={404} />
  }
  return (
    <Layout>
      <article>
        <Head>
          {renderMetaTags(post.metadata)}
        </Head>
        <PostHeader
          title={post.title}
          coverImage={post.coverImage}
          date={post.date}
          category={post.category}
        />
        <Container>
          <PostBody
            content={post.content}
            author={post.author}
            tags={post.tags.split(', ').filter(Boolean)}
          />
        </Container>
      </article>
      <SectionSeparator />
      <Container>
        <div className="max-w-2xl mx-auto">
          {morePosts.length > 0 && (
            <MoreStories
              posts={morePosts}
              hasTitle={true}
            />
          )}
        </div>
      </Container>
    </Layout>
  )
}

export async function getStaticPaths() {
  return {
    paths: [], // indicates that no page needs be created at build time
    fallback: 'blocking' // indicates the type of fallback
}
}

export async function getStaticProps({ params }) {
  const data = await getDataForPostSlug(params.slug)
  const content = await markdownToHtml(data?.post?.content || '')

  return {
    props: {
      post: {
        ...data?.post,
        content,
      },
      morePosts: data?.morePosts,
    },
    revalidate: 60
  }
}