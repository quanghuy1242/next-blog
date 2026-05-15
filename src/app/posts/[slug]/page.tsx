import { draftMode } from 'next/headers';
import { notFound } from 'next/navigation';

import { getPostPageData } from '@/lib/server/posts/page-data';
import { getCoverImageUrl } from '@/lib/utils/image';
import { buildMetadata } from '@/lib/utils/next-metadata';
import { normalizePostTags } from '@/lib/utils/tags';
import { Container } from '@/components/core/container';
import { Layout } from '@/components/core/layout';
import { PostContent } from '@/components/pages/posts/post-content';
import { PostHeader } from '@/components/pages/posts/post-header';
import { CommentsSection } from '@/components/shared/comments/CommentsSection';
import { Posts } from '@/components/shared/posts';
import { SectionSeparator } from '@/components/shared/section-separator';
import { Text } from '@/components/shared/text';

export const revalidate = 60;

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PostPageProps) {
  const { slug } = await params;
  const preview = await draftMode();
  const data = await getPostPageData(slug, preview.isEnabled);

  return buildMetadata({
    title: data.post?.meta?.title || data.post?.title,
    description: data.post?.meta?.description || data.post?.excerpt || undefined,
    image: data.post?.meta?.image?.url || (data.post?.coverImage ? getCoverImageUrl(data.post.coverImage) : null),
    type: 'article',
  });
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const preview = await draftMode();
  const data = await getPostPageData(slug, preview.isEnabled);

  if (!data.post?.slug) {
    notFound();
  }

  const categoryName =
    typeof data.post.category === 'string' ? data.post.category : data.post.category?.name || '';
  const tags = normalizePostTags(data.post.tags);

  return (
    <Layout className="flex flex-col items-center" isDraftMode={preview.isEnabled}>
      <article className="flex w-full flex-col items-center">
        <PostHeader
          header={data.post.title ?? ''}
          date={data.post.createdAt ?? data.post.updatedAt ?? ''}
          category={categoryName}
          coverImage={data.post.coverImage}
          className="w-full"
        />
        <Container className="my-4 flex justify-center">
          <PostContent content={data.post.content} tags={tags} />
        </Container>
      </article>
      <Container>
        <div className="mx-auto max-w-3xl">
          {/*
            Post content is cacheable and should not wait on live, viewer-scoped
            comments. Comments hydrate through /api/comments after the article is
            visible, matching the chapter-reader architecture.
          */}
          <CommentsSection postId={String(data.post.id)} />
        </div>
      </Container>
      <SectionSeparator />
      <Container>
        <div className="mx-auto max-w-2xl">
          {data.morePosts.length > 0 ? (
            <>
              <Text text="More posts" />
              <Posts posts={data.morePosts} />
            </>
          ) : null}
        </div>
      </Container>
    </Layout>
  );
}
