import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDataForHome } from 'common/apis/index';
import { Container } from 'components/core/container';
import { Layout } from 'components/core/layout';
import { Banner } from 'components/pages/index/banner';
import { Categories } from 'components/shared/categories';
import { Posts } from 'components/shared/posts';
import { Text } from 'components/shared/text';
import type { GetStaticProps } from 'next';
import Head from 'next/head';
import { renderMetaTags } from 'react-datocms';
import { useRouter } from 'next/router';
import type { HomePageData, Post } from 'types/datocms';
import { useAppContext, type HomePostsState } from 'context/state';

interface HomePageProps {
  allPosts: HomePageData['allPosts'];
  allCategories: HomePageData['allCategories'];
  homepage: HomePageData['homepage'];
}

const POSTS_PAGE_SIZE = 5;

export default function Index({
  allPosts,
  homepage,
  allCategories,
}: HomePageProps) {
  const header = homepage?.header || '';
  const initialState = useMemo<HomePostsState>(
    () => ({
      posts: allPosts,
      offset: allPosts.length,
      hasMore: allPosts.length === POSTS_PAGE_SIZE,
      category: null,
      tag: null,
    }),
    [allPosts]
  );

  const { homePosts, setHomePosts } = useAppContext();
  const router = useRouter();
  const activeCategory = useMemo(
    () =>
      router.isReady ? normalizeQueryParam(router.query.category) : null,
    [router.isReady, router.query.category]
  );
  const activeTag = useMemo(
    () => (router.isReady ? normalizeQueryParam(router.query.tag) : null),
    [router.isReady, router.query.tag]
  );
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const hasHydratedFromContext = useRef(false);

  const [postsState, setPostsState] = useState<HomePostsState>(
    () => homePosts ?? initialState
  );
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady || hasHydratedFromContext.current) {
      return;
    }

    if (homePosts && filtersMatch(homePosts, activeCategory, activeTag)) {
      setPostsState(homePosts);
    }

    hasHydratedFromContext.current = true;
  }, [router.isReady, homePosts, activeCategory, activeTag]);

  useEffect(() => {
    if (!hasHydratedFromContext.current) {
      return;
    }

    if (postsState !== homePosts) {
      setHomePosts(postsState);
    }
  }, [postsState, homePosts, setHomePosts]);

  const fetchPostsForFilters = useCallback(async () => {
    if (!router.isReady) {
      return;
    }

    if (filtersMatch(postsState, activeCategory, activeTag)) {
      return;
    }

    if (!activeCategory && !activeTag) {
      setPostsState({
        posts: allPosts,
        offset: allPosts.length,
        hasMore: allPosts.length === POSTS_PAGE_SIZE,
        category: null,
        tag: null,
      });
      setIsFetching(false);
      setError(null);
      return;
    }

    const params = new URLSearchParams({
      limit: POSTS_PAGE_SIZE.toString(),
      offset: '0',
    });

    if (activeCategory) {
      params.set('category', activeCategory);
    }

    if (activeTag) {
      params.set('tag', activeTag);
    }

    setIsFetching(true);
    setError(null);

    try {
      const response = await fetch(`/api/posts?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as PaginatedPostsApiResponse;
      const posts = payload.posts ?? [];
      const nextOffset = payload.nextOffset ?? posts.length;

      setPostsState({
        posts,
        offset: nextOffset,
        hasMore: payload.hasMore ?? false,
        category: activeCategory,
        tag: activeTag,
      });
    } catch (loadError) {
      console.error('Failed to fetch filtered posts', loadError);
      setError('Unable to load posts for this filter. Tap to retry.');
    } finally {
      setIsFetching(false);
    }
  }, [
    router.isReady,
    postsState,
    activeCategory,
    activeTag,
    allPosts,
  ]);

  useEffect(() => {
    void fetchPostsForFilters();
  }, [fetchPostsForFilters]);

  const loadMorePosts = useCallback(async () => {
    if (isFetching || !postsState.hasMore) {
      return;
    }

    const { category: currentCategory, tag: currentTag } = postsState;

    setIsFetching(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        offset: postsState.offset.toString(),
        limit: POSTS_PAGE_SIZE.toString(),
      });

      if (currentCategory) {
        params.set('category', currentCategory);
      }

      if (currentTag) {
        params.set('tag', currentTag);
      }

      const response = await fetch(`/api/posts?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as PaginatedPostsApiResponse;

      setPostsState((previous) => {
        if (!filtersMatch(previous, currentCategory, currentTag)) {
          return previous;
        }

        const mergedPosts = mergePosts(previous.posts, payload.posts ?? []);

        const nextOffset = Math.max(
          payload.nextOffset ?? previous.offset,
          mergedPosts.length
        );

        return {
          posts: mergedPosts,
          offset: nextOffset,
          hasMore: payload.hasMore ?? previous.hasMore,
          category: previous.category ?? currentCategory ?? null,
          tag: previous.tag ?? currentTag ?? null,
        };
      });
    } catch (loadError) {
      console.error('Failed to load more posts', loadError);
      setError('Unable to load more posts right now. Tap to retry.');
    } finally {
      setIsFetching(false);
    }
  }, [isFetching, postsState]);

  useEffect(() => {
    if (!postsState.hasMore) {
      return;
    }

    const sentinel = loaderRef.current;

    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (entry?.isIntersecting) {
          void loadMorePosts();
        }
      },
      {
        rootMargin: '200px 0px',
      }
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [loadMorePosts, postsState.hasMore]);

  return (
    <Layout header={header} className="flex flex-col items-center">
      <Head>{renderMetaTags(homepage?.metadata || [])}</Head>
      <Banner
        header={header}
        subHeader={homepage?.subHeader || ''}
        className="w-full"
      />
      <Container className="flex flex-col md:flex-row md:px-20">
        <div className="flex-grow md:w-2/3 md:mr-6">
          <Text text="Latest Posts" />
          <Posts posts={postsState.posts} hasMoreCol={false} />
          {!isFetching && !error && postsState.posts.length === 0 && (
            <p className="mt-6 text-center text-sm text-gray-500">
              No posts found for this filter.
            </p>
          )}
          <div ref={loaderRef} className="h-1 w-full" aria-hidden />
          {isFetching && (
            <div className="my-6 flex justify-center">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
            </div>
          )}
          {error && (
            <div className="mt-4 flex flex-col items-center text-center">
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => {
                  if (activeCategory || activeTag) {
                    void fetchPostsForFilters();
                  } else {
                    void loadMorePosts();
                  }
                }}
                className="mt-2 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:border-gray-400 hover:text-gray-900"
              >
                Try again
              </button>
            </div>
          )}
          {!postsState.hasMore && !isFetching && (
            <p className="my-6 text-center text-sm text-gray-500">
              You&apos;ve reached the end.
            </p>
          )}
        </div>
        <div className="md:w-1/3">
          <Text text="Categories" />
          <Categories categories={allCategories} />
        </div>
      </Container>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps<HomePageProps> = async () => {
  const data = await getDataForHome();

  return {
    props: {
      allPosts: data.allPosts ?? [],
      allCategories: data.allCategories ?? [],
      homepage: data.homepage ?? null,
    },
    revalidate: 60,
  };
};

interface PaginatedPostsApiResponse {
  posts?: Post[];
  hasMore?: boolean;
  nextOffset?: number;
}

function mergePosts(current: Post[], incoming: Post[]): Post[] {
  if (!incoming.length) {
    return current;
  }

  const seen = new Set(current.map((post) => post.slug));
  const merged = [...current];

  for (const post of incoming) {
    if (!seen.has(post.slug)) {
      seen.add(post.slug);
      merged.push(post);
    }
  }

  return merged;
}

function filtersMatch(
  state: HomePostsState | null,
  category: string | null,
  tag: string | null
): boolean {
  if (!state) {
    return false;
  }

  return (state.category ?? null) === category && (state.tag ?? null) === tag;
}

function normalizeQueryParam(
  value: string | string[] | undefined
): string | null {
  if (Array.isArray(value)) {
    return normalizeQueryParam(value[0]);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}
