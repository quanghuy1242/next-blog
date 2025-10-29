import { getCategoryIdBySlug } from 'common/apis/categories';
import { getDataForHome } from 'common/apis/index';
import { Container } from 'components/core/container';
import { Banner } from 'components/pages/index/banner';
import { Categories } from 'components/shared/categories';
import { Posts } from 'components/shared/posts';
import { Text } from 'components/shared/text';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

type SearchParams = {
  category?: string;
  tag?: string[] | string;
  page?: string;
};

const POSTS_PAGE_SIZE = 5;

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const categorySlug = (searchParams.category || null) as string | null;
  const tagsParam = searchParams.tag;
  const tags = Array.isArray(tagsParam)
    ? tagsParam
    : tagsParam
    ? [tagsParam]
    : null;

  let categoryId: number | null = null;
  if (categorySlug) {
    categoryId = await getCategoryIdBySlug(categorySlug);
  }

  const { data, hasMore } = await getDataForHome({
    limit: POSTS_PAGE_SIZE,
    categoryId: categoryId ? String(categoryId) : null,
    tags,
  });

  const header = data.homepage?.header || '';
  const subHeader = data.homepage?.subHeader || '';

  const initialPosts = categorySlug && !categoryId ? [] : data.allPosts;
  const initialHasMore = categorySlug && !categoryId ? false : hasMore;

  return (
    <div className="flex flex-col items-center">
      <Banner
        header={header}
        subHeader={subHeader}
        imageBanner={data.homepage?.imageBanner || null}
        className="w-full"
      />

      <Container className="flex flex-col md:flex-row md:px-20 w-full">
        <div className="flex-grow md:w-2/3 md:mr-6">
          <Text text="Latest Posts" />
          {/* Initial list; infinite scroll will append more on client */}
          <Posts
            posts={initialPosts}
            hasMoreCol={false}
            activeCategory={categorySlug}
            activeTags={Array.isArray(tags) ? tags : []}
          />
          {/* Client component handling infinite scroll */}
          <InfinitePostList
            initialPosts={initialPosts}
            initialHasMore={initialHasMore}
            category={categorySlug}
            tags={Array.isArray(tags) ? tags : []}
            pageSize={POSTS_PAGE_SIZE}
          />
        </div>
        <div className="md:w-1/3">
          <Text text="Categories" />
          <Categories categories={data.allCategories} />
        </div>
      </Container>
    </div>
  );
}

// Lazy import to avoid Next trying to render on server
import InfinitePostList from './components/infinite-post-list';

export async function generateMetadata(): Promise<Metadata> {
  const { data } = await getDataForHome({ limit: 0 });
  const title = data.homepage?.header || 'Blog';
  const description = data.homepage?.subHeader || '';
  const image = data.homepage?.meta?.image?.url || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [{ url: image }] : undefined,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}
