import { useRouter } from 'next/router'
import ErrorPage from 'next/error'
import Container from '../../components/container'
import PostBody from '../../components/post-body'
import MoreStories from '../../components/more-stories'
import Header from '../../components/header'
import PostHeader from '../../components/post-header'
import SectionSeparator from '../../components/section-separator'
import Layout from '../../components/layout'
import { getPostAndMorePosts } from '../../lib/api'
import PostTitle from '../../components/post-title'
import Head from 'next/head'
import markdownToHtml from '../../lib/markdownToHtml'
import { renderMetaTags } from 'react-datocms'; 
import Avatar from '../../components/avatar'

export default function Post({ post, morePosts, preview }) {
  const router = useRouter()
  if (!router.isFallback && !post?.slug) {
    return <ErrorPage statusCode={404} />
  }
  return (
    <Layout preview={preview}>
      <Header />
      <div className="mt-16" />
      {router.isFallback ? (
          <PostTitle>Loading…</PostTitle>
        ) : (
          <>
            <article>
              <Head>
                {renderMetaTags(post.metadata)}
              </Head>
              <PostHeader
                title={post.title}
                coverImage={post.coverImage}
                date={post.date}
              />
              <Container>
                <PostBody content={post.content} author={post.author} />
              </Container>
            </article>
            <SectionSeparator />
            <Container>
              <div className="max-w-2xl mx-auto">
                {morePosts.length > 0 && <MoreStories posts={morePosts} hasMoreCol={false} hasTitle={true} />}
              </div>
            </Container>
          </>
        )}
    </Layout>
  )
}

export async function getServerSideProps({ params, preview = null }) {
  const data = await getPostAndMorePosts(params.slug, preview)
  const content = await markdownToHtml(data?.post?.content || '')

  return {
    props: {
      preview,
      post: {
        ...data?.post,
        content,
      },
      morePosts: data?.morePosts,
    },
  }
}