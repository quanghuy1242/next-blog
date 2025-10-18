import { Container } from 'components/core/container';
import { Layout } from 'components/core/layout';
import { PostContent } from 'components/pages/posts_slugs/post-content';
import { PostHeader } from 'components/pages/posts_slugs/post-header';
import { Posts } from 'components/shared/posts';
import { SectionSeparator } from 'components/shared/section-separator';
import { Text } from 'components/shared/text';
import { getDataForPostSlug } from 'common/apis/posts.slug';
import markdownToHtml from 'common/markdown-to-html';
import type { GetStaticPaths, GetStaticProps } from 'next';
import ErrorPage from 'next/error';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { renderMetaTags } from 'react-datocms';
import type { Post as PostType, PostSlugData } from 'types/datocms';

interface PostPageProps {
  post: (PostType & { content: string }) | null;
  morePosts: PostType[];
  homepage: PostSlugData['homepage'];
}

export default function PostPage({
  post,
  morePosts,
  homepage,
}: PostPageProps) {
  const router = useRouter();

  if (!router.isFallback && !post?.slug) {
    return <ErrorPage statusCode={404} />;
  }

  const header = homepage?.header || '';
  const metaTags = post?.metadata || [];
  const categoryName =
    typeof post?.category === 'string'
      ? post.category
      : post?.category?.name || '';
  const imageUrl =
    post?.ogImage?.url ??
    post?.coverImage.responsiveImage.src ??
    '';
  const tags = normalizeTags(post?.tags);
  const morePostList = Array.isArray(morePosts) ? morePosts : [];

  return (
    <Layout header={header} className="flex flex-col items-center">
      <article className="flex flex-col items-center w-full">
        <Head>{renderMetaTags(metaTags)}</Head>
        <PostHeader
          header={post?.title ?? ''}
          date={post?.date ?? ''}
          category={categoryName}
          imageUrl={imageUrl}
          className="w-full"
        />
        <Container className="my-4 flex justify-center">
          <PostContent
            content={post?.content ?? ''}
            tags={tags}
          />
        </Container>
      </article>
      <SectionSeparator />
      <Container>
        <div className="max-w-2xl mx-auto">
          {morePostList.length > 0 && (
            <>
              <Text text="More posts" />
              <Posts posts={morePostList} />
            </>
          )}
        </div>
      </Container>
    </Layout>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [], // indicates that no page needs be created at build time
    fallback: 'blocking', // indicates the type of fallback
  };
};

export const getStaticProps: GetStaticProps<PostPageProps> = async ({
  params,
}) => {
  const slugParam = Array.isArray(params?.slug)
    ? params?.slug[0]
    : params?.slug;

  if (!slugParam) {
    return {
      notFound: true,
    };
  }

  const data = await getDataForPostSlug(slugParam);
  const content = await markdownToHtml(data.post?.content ?? '');
  const postWithContent = data.post
    ? { ...data.post, content }
    : null;

  return {
    props: {
      post: postWithContent,
      morePosts: data.morePosts ?? [],
      homepage: data.homepage ?? null,
    },
    revalidate: 60,
  };
};

function normalizeTags(
  tags: PostType['tags'] | undefined
): string[] {
  if (typeof tags === 'string') {
    return tags.split(', ').filter(Boolean);
  }

  if (Array.isArray(tags)) {
    return tags.filter((tag): tag is string => Boolean(tag));
  }

  return [];
}
