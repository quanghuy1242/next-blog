import { getDataForPostSlug } from 'common/apis/posts.slug';
import markdownToHtml from 'common/markdown-to-html';
import ErrorPage from 'next/error';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { renderMetaTags } from 'react-datocms';
import { Container } from 'components/core/container';
import { Layout } from 'components/core/layout';
import { Posts } from 'components/shared/posts';
import { SectionSeparator } from 'components/shared/section-separator';
import { PostContent } from 'components/pages/posts_slugs/post-content';
import { PostHeader } from 'components/pages/posts_slugs/post-header';
import { Text } from 'components/shared/text';

export default function Post({ post, morePosts, homepage }) {
  const router = useRouter();
  if (!router.isFallback && !post?.slug) {
    return <ErrorPage statusCode={404} />;
  }
  const header = homepage?.header || '';
  const metaTags = post?.metadata || [];
  const categoryName = post?.category?.name || '';
  const morePostList = Array.isArray(morePosts) ? morePosts : [];
  return (
    <Layout header={header} className="flex flex-col items-center">
      <article className="flex flex-col items-center w-full">
        <Head>{renderMetaTags(metaTags)}</Head>
        <PostHeader
          header={post?.title}
          date={post?.date}
          category={categoryName}
          imageUrl={post?.ogImage?.url}
          className="w-full"
        />
        <Container className="my-4 flex justify-center">
          <PostContent
            content={post?.content}
            author={post?.author}
            tags={
              typeof post?.tags === 'string'
                ? post.tags.split(', ').filter(Boolean)
                : Array.isArray(post?.tags)
                ? post.tags
                : []
            }
          />
        </Container>
      </article>
      <SectionSeparator />
      <Container>
        <div className="max-w-2xl mx-auto">
          {morePostList.length > 0 && (
            <>
              <Text text="More posts" />
              <Posts posts={morePostList} hasTitle={true} />
            </>
          )}
        </div>
      </Container>
    </Layout>
  );
}

export async function getStaticPaths() {
  return {
    paths: [], // indicates that no page needs be created at build time
    fallback: 'blocking', // indicates the type of fallback
  };
}

export async function getStaticProps({ params }) {
  const data = await getDataForPostSlug(params.slug);
  const content = await markdownToHtml(data?.post?.content || '');

  return {
    props: {
      post: {
        ...data?.post,
        content,
      },
      morePosts: data?.morePosts || [],
      homepage: data?.homepage || null,
    },
    revalidate: 60,
  };
}
