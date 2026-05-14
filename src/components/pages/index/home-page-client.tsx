'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

import { useAppContext } from '@/context/state';
import { useHomePosts } from '@/hooks/useHomePosts';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { normalizeQueryParam, normalizeQueryParamList } from '@/lib/utils/query';
import type { Category, Homepage, Post } from '@/types/cms';
import { Banner } from '@/components/pages/index/banner';
import { Container } from '@/components/core/container';
import { Categories } from '@/components/shared/categories';
import { CategoriesRail } from '@/components/shared/categories-rail';
import { BOOKS_CTA_MEDIA, BooksCtaCard } from '@/components/shared/books-cta-card';
import { LoadingSpinner } from '@/components/shared/ui/loading-spinner';
import { Button } from '@/components/shared/ui/button';
import { Posts } from '@/components/shared/posts';
import { Text } from '@/components/shared/text';

interface HomePageClientProps {
  initialPosts: Post[];
  allCategories: Category[];
  homepage: Homepage | null;
  initialHasMore: boolean;
  initialCategory: string | null;
  initialTags: string[];
}

const POSTS_PAGE_SIZE = 5;

export function HomePageClient({
  initialPosts,
  allCategories,
  homepage,
  initialHasMore,
  initialCategory,
  initialTags,
}: HomePageClientProps) {
  const { homePosts, setHomePosts } = useAppContext();
  const searchParams = useSearchParams();
  const activeCategory = normalizeQueryParam(searchParams?.get('category') ?? undefined);
  const activeTags = normalizeQueryParamList(searchParams?.getAll('tag') ?? undefined);
  const {
    postsState,
    isFetching,
    error,
    hasActiveFilters,
    loadMorePosts,
    refetchCurrentFilters,
  } = useHomePosts({
    initialPosts,
    initialHasMore,
    initialCategory,
    initialTags,
    pageSize: POSTS_PAGE_SIZE,
    activeCategory,
    activeTags,
    routerReady: true,
    homePosts,
    setHomePosts,
  });
  const { ref: loaderRef, isIntersecting } = useIntersectionObserver<HTMLDivElement>({
    rootMargin: '200px 0px',
    enabled: postsState.hasMore,
  });

  useEffect(() => {
    if (isIntersecting && postsState.hasMore) {
      void loadMorePosts();
    }
  }, [isIntersecting, postsState.hasMore, loadMorePosts]);

  return (
    <>
      <Banner
        header={homepage?.header || ''}
        subHeader={homepage?.subHeader || ''}
        imageBanner={homepage?.imageBanner || null}
        className="w-full"
      />
      <Container className="md:px-20">
        <div className="mb-4 md:hidden">
          <Text text="Browse" />
          <CategoriesRail categories={allCategories} booksMedia={BOOKS_CTA_MEDIA} />
        </div>

        <div className="flex flex-col md:flex-row">
          <div className="flex-grow md:w-2/3 md:mr-6">
            <Text text="Latest Posts" />
            <Posts
              posts={postsState.posts}
              hasMoreCol={false}
              activeCategory={postsState.category}
              activeTags={postsState.tags}
            />
            {!isFetching && !error && postsState.posts.length === 0 ? (
              <p className="mt-6 text-center text-sm text-gray-500">
                No posts found for this filter.
              </p>
            ) : null}
            <div ref={loaderRef} className="h-1 w-full" aria-hidden />
            {isFetching ? (
              <div className="my-6 flex justify-center">
                <LoadingSpinner />
              </div>
            ) : null}
            {error ? (
              <div className="mt-4 flex flex-col items-center text-center">
                <p className="text-sm text-red-600">{error}</p>
                <Button
                  type="button"
                  onClick={() => {
                    if (hasActiveFilters) {
                      void refetchCurrentFilters();
                    } else {
                      void loadMorePosts();
                    }
                  }}
                  variant="secondary"
                  className="mt-2"
                >
                  Try again
                </Button>
              </div>
            ) : null}
            {!postsState.hasMore && !isFetching ? (
              <p className="my-6 text-center text-sm text-gray-500">
                You&apos;ve reached the end.
              </p>
            ) : null}
          </div>

          <div className="hidden md:block md:w-1/3">
            <Text text="Books" />
            <BooksCtaCard />
            <Text text="Categories" />
            <Categories categories={allCategories} />
          </div>
        </div>
      </Container>
    </>
  );
}
