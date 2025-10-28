import { Container } from 'components/core/container';
import { PostContent } from 'components/pages/posts_slugs/post-content';
import { PostHeader } from 'components/pages/posts_slugs/post-header';
import { Posts } from 'components/shared/posts';
import { SectionSeparator } from 'components/shared/section-separator';
import { Text } from 'components/shared/text';
import { getDataForPostSlug } from 'common/apis/posts.slug';
import { generatePostMetaTags } from 'common/utils/meta-tags';
import { getCoverImageUrl } from 'common/utils/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { normalizePostTags } from 'common/utils/tags';

interface PageProps {
  params: {
    slug: string;
  };
}

export const dynamic = 'force-dynamic';

export default async function Page({ params }: PageProps) {
  const data = await getDataForPostSlug(params.slug);

  if (!data.post?.slug) {
    notFound();
  }

  const _post = data.post;
  const morePosts = data.morePosts ?? [];
  const _homepage = data.homepage;

  const _metaImageUrl = _post.coverImage
    ? getCoverImageUrl(_post.coverImage)
    : '';

  const categoryName = _post.category?.name || '';
  const tags = normalizePostTags(_post.tags);
  const morePostList = Array.isArray(morePosts) ? morePosts : [];

  return (
    <main className="flex flex-col items-center">
      <div className="mt-16" />
      <article className="flex flex-col items-center w-full">
        <PostHeader
          header={_post.title}
          date={_post.createdAt ?? _post.updatedAt ?? ''}
          category={categoryName}
          coverImage={_post.coverImage}
          className="w-full"
        />
        <Container className="my-4 flex justify-center">
          <PostContent content={_post.content} tags={tags} />
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
    </main>
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const data = await getDataForPostSlug(params.slug);

  if (!data.post) {
    return {};
  }

  const post = data.post;
  const metaImageUrl = post.coverImage ? getCoverImageUrl(post.coverImage) : '';

  const metaTags = generatePostMetaTags(post.meta, {
    title: post.title,
    description: post.excerpt || undefined,
    image: metaImageUrl,
  });

  const metadata: Metadata = {
    title: metaTags.find((tag) => tag.tag === 'title')?.content || post.title,
  };

  const description = metaTags.find(
    (tag) => tag.tag === 'meta' && tag.attributes?.name === 'description'
  )?.attributes?.content;
  if (description) {
    metadata.description = description;
  }

  const ogImage = metaTags.find(
    (tag) => tag.tag === 'meta' && tag.attributes?.property === 'og:image'
  )?.attributes?.content;
  if (ogImage) {
    metadata.openGraph = { images: [ogImage] };
  }

  return metadata;
}
