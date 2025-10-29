import { getDataForPostSlug } from 'common/apis/posts.slug';
import { Container } from 'components/core/container';
import { PostContent } from 'components/pages/posts_slugs/post-content';
import { PostHeader } from 'components/pages/posts_slugs/post-header';
import { Posts } from 'components/shared/posts';
import { SectionSeparator } from 'components/shared/section-separator';
import { Text } from 'components/shared/text';
import type { Metadata } from 'next';
import { getCoverImageUrl } from 'common/utils/image';
import { normalizePostTags } from 'common/utils/tags';

export const revalidate = 3600; // ISR every hour

export default async function Page({ params }: { params: { slug: string } }) {
  const data = await getDataForPostSlug(params.slug);
  const post = data.post;

  if (!post) {
    // Next will render 404 page
    return null;
  }

  const categoryName =
    typeof post.category === 'string'
      ? post.category
      : post.category?.name || '';
  const tags = normalizePostTags(post.tags);
  const morePosts = Array.isArray(data.morePosts) ? data.morePosts : [];

  return (
    <div className="flex flex-col items-center">
      <article className="flex flex-col items-center w-full">
        <PostHeader
          header={post.title}
          date={post.createdAt || post.updatedAt || ''}
          category={categoryName}
          coverImage={post.coverImage}
          className="w-full"
        />
        <Container className="my-4 flex justify-center">
          <PostContent content={post.content} tags={tags} />
        </Container>
      </article>
      <SectionSeparator />
      <Container>
        <div className="max-w-2xl mx-auto">
          {morePosts.length > 0 && (
            <>
              <Text text="More posts" />
              <Posts posts={morePosts} />
            </>
          )}
        </div>
      </Container>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const data = await getDataForPostSlug(params.slug);
  const post = data.post;
  const title = post?.meta?.title || post?.title || 'Post';
  const description = post?.meta?.description || post?.excerpt || '';
  const image = post?.coverImage
    ? getCoverImageUrl(post.coverImage)
    : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [{ url: image }] : undefined,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}
