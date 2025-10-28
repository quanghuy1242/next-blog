import { getDataForHome } from 'common/apis/index';
import { getCategoryIdBySlug } from 'common/apis/categories';
import { Container } from 'components/core/container';
import { Banner } from 'components/pages/index/banner';
import { Categories } from 'components/shared/categories';
import { Text } from 'components/shared/text';
import { generateHomepageMetaTags } from 'common/utils/meta-tags';
import type { Metadata } from 'next';
import {
  normalizeQueryParam,
  normalizeQueryParamList,
} from 'common/utils/query';
import { InfinitePostList } from './components/infinite-post-list';

const POSTS_PAGE_SIZE = 5;

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: {
    category?: string;
    tag?: string[];
    page?: string;
  };
}

export default async function Page({ searchParams }: PageProps) {
  const category = normalizeQueryParam(searchParams.category);
  const tags = normalizeQueryParamList(searchParams.tag);

  let categoryId: number | null = null;
  if (category) {
    categoryId = await getCategoryIdBySlug(category);
  }

  const { data, hasMore } = await getDataForHome({
    limit: POSTS_PAGE_SIZE,
    categoryId: categoryId ? String(categoryId) : null,
    tags: tags.length ? tags : null,
  });

  const categoryIsValid = !category || Boolean(categoryId);
  const initialPosts = categoryIsValid ? data.allPosts ?? [] : [];
  const initialHasMore = categoryIsValid ? hasMore : false;

  const allCategories = data.allCategories ?? [];
  const homepage = data.homepage ?? null;

  return (
    <main className="flex flex-col items-center">
      <div className="mt-16" />
      <Banner
        header={homepage?.header || ''}
        subHeader={homepage?.subHeader || ''}
        imageBanner={homepage?.imageBanner || null}
        className="w-full"
      />
      <Container className="flex flex-col md:flex-row md:px-20">
        <div className="flex-grow md:w-2/3 md:mr-6">
          <Text text="Latest Posts" />
          <InfinitePostList
            initialPosts={initialPosts}
            initialHasMore={initialHasMore}
            category={category}
            tags={tags}
          />
        </div>
        <div className="md:w-1/3">
          <Text text="Categories" />
          <Categories categories={allCategories} />
        </div>
      </Container>
    </main>
  );
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const category = normalizeQueryParam(searchParams.category);
  const tags = normalizeQueryParamList(searchParams.tag);

  let categoryId: number | null = null;
  if (category) {
    categoryId = await getCategoryIdBySlug(category);
  }

  const { data } = await getDataForHome({
    limit: POSTS_PAGE_SIZE,
    categoryId: categoryId ? String(categoryId) : null,
    tags: tags.length ? tags : null,
  });

  const homepage = data.homepage ?? null;
  const metaTags = generateHomepageMetaTags(homepage?.meta, {
    title: homepage?.header || 'Blog',
    description: homepage?.subHeader || '',
  });

  // Convert to Next.js metadata format
  const metadata: Metadata = {
    title: metaTags.find((tag) => tag.tag === 'title')?.content || 'Blog',
  };

  const description = metaTags.find(
    (tag) => tag.tag === 'meta' && tag.attributes?.name === 'description'
  )?.attributes?.content;
  if (description) {
    metadata.description = description;
  }

  // Add other meta tags if needed
  const ogTitle = metaTags.find(
    (tag) => tag.tag === 'meta' && tag.attributes?.property === 'og:title'
  )?.attributes?.content;
  if (ogTitle) {
    metadata.openGraph = { title: ogTitle };
  }

  const ogDescription = metaTags.find(
    (tag) => tag.tag === 'meta' && tag.attributes?.property === 'og:description'
  )?.attributes?.content;
  if (ogDescription && metadata.openGraph) {
    metadata.openGraph.description = ogDescription;
  }

  return metadata;
}
