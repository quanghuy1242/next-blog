import { Container } from 'components/core/container';
import { Layout } from 'components/core/layout';
import { renderMetaTags } from 'components/core/metadata';
import { PostContent } from 'components/pages/posts_slugs/post-content';
import { PostHeader } from 'components/pages/posts_slugs/post-header';
import { Posts } from 'components/shared/posts';
import { SectionSeparator } from 'components/shared/section-separator';
import { Text } from 'components/shared/text';
import { getDataForPostSlug } from 'common/apis/posts.slug';
import { generatePostMetaTags } from 'common/utils/meta-tags';
import { getCoverImageUrl } from 'common/utils/image';
import type { GetStaticPaths, GetStaticProps } from 'next';
import ErrorPage from 'next/error';
import Head from 'next/head';
import { useRouter } from 'next/router';
import type { Post as PostType, PostSlugData } from 'types/cms';
import { normalizePostTags } from 'common/utils/tags';

interface PostPageProps {
  post: PostType | null;
  morePosts: PostType[];
  homepage: PostSlugData['homepage'];
}

export default function PostPage({ post, morePosts, homepage }: PostPageProps) {
  const router = useRouter();

  if (!router.isFallback && !post?.slug) {
    return <ErrorPage statusCode={404} />;
  }

  const header = homepage?.header || '';

  // Optimize cover image for social media previews (Open Graph standard: 1200x630)
  // Pass Media object to use optimizedUrl directly - CSS handles sizing
  const metaImageUrl = post?.coverImage
    ? getCoverImageUrl(post.coverImage)
    : '';
  const metaTags = generatePostMetaTags(post?.meta, {
    title: post?.title,
    description: post?.excerpt || undefined,
    image: metaImageUrl,
  });

  const categoryName =
    typeof post?.category === 'string'
      ? post.category
      : post?.category?.name || '';
  const tags = normalizePostTags(post?.tags);
  const morePostList = Array.isArray(morePosts) ? morePosts : [];

  return (
    <Layout header={header} className="flex flex-col items-center">
      <article className="flex flex-col items-center w-full">
        <Head>{renderMetaTags(metaTags)}</Head>
        <PostHeader
          header={post?.title ?? ''}
          date={post?.createdAt ?? post?.updatedAt ?? ''}
          category={categoryName}
          coverImage={post?.coverImage}
          className="w-full"
        />
        <Container className="my-4 flex justify-center">
          <PostContent content={post?.content} tags={tags} />
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

  return {
    props: {
      post: data.post ?? null,
      morePosts: data.morePosts ?? [],
      homepage: data.homepage ?? null,
    },
    revalidate: 60,
  };
};
