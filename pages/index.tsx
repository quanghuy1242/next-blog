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
import {
  areStringArraysEqual,
  normalizeQueryParam,
  normalizeQueryParamList,
} from 'common/utils/query';

interface HomePageProps {
  allPosts: HomePageData['allPosts'];
  allCategories: HomePageData['allCategories'];
  homepage: HomePageData['homepage'];
}

const POSTS_PAGE_SIZE = 5;

/**
 * Home page with filter-aware infinite scrolling.
 *
 * Reads `category`/`tag` query params, fetches matching posts, and keeps the
 * result cached via context so navigating back restores the filtered view. All
 * fetching honours the active filters, including the infinite scroll loader.
 */
export default function Index({
  allPosts,
  homepage,
  allCategories,
}: HomePageProps) {
  const header = homepage?.header || '';
  // Memoize the baseline list so we can restore it when filters clear.
  const initialState = useMemo<HomePostsState>(
    () => ({
      posts: allPosts,
      offset: allPosts.length,
      hasMore: allPosts.length === POSTS_PAGE_SIZE,
      category: null,
      tags: [],
    }),
    [allPosts]
  );

  const { homePosts, setHomePosts } = useAppContext();
  const router = useRouter();
  // Derive normalized query params once per render to avoid churn.
  const activeCategory = useMemo(
    () => (router.isReady ? normalizeQueryParam(router.query.category) : null),
    [router.isReady, router.query.category]
  );
  const activeTags = useMemo(
    () => (router.isReady ? normalizeQueryParamList(router.query.tag) : []),
    [router.isReady, router.query.tag]
  );
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const hasHydratedFromContext = useRef(false);

  const [postsState, setPostsState] = useState<HomePostsState>(
    () => homePosts ?? initialState
  );
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate from context (if available) once on the client.
  useEffect(() => {
    if (!router.isReady || hasHydratedFromContext.current) {
      return;
    }

    if (homePosts && filtersMatch(homePosts, activeCategory, activeTags)) {
      setPostsState(homePosts);
    }

    hasHydratedFromContext.current = true;
  }, [router.isReady, homePosts, activeCategory, activeTags]);

  // Persist the latest state back into context after hydration.
  useEffect(() => {
    if (!hasHydratedFromContext.current) {
      return;
    }

    if (postsState !== homePosts) {
      setHomePosts(postsState);
    }
  }, [postsState, homePosts, setHomePosts]);

  /**
   * Fetch the first page for the current filter set and reset local state.
   * Invoked on mount and whenever the router query changes.
   */
  const fetchPostsForFilters = useCallback(async () => {
    if (!router.isReady) {
      return;
    }

    if (filtersMatch(postsState, activeCategory, activeTags)) {
      return;
    }

    if (!activeCategory && activeTags.length === 0) {
      // No filters selected, revert to the initial SSR payload.
      setPostsState({
        posts: allPosts,
        offset: allPosts.length,
        hasMore: allPosts.length === POSTS_PAGE_SIZE,
        category: null,
        tags: [],
      });
      setIsFetching(false);
      setError(null);
      return;
    }

    // Build the fetch URL with the active filters.
    const params = new URLSearchParams({
      limit: POSTS_PAGE_SIZE.toString(),
      offset: '0',
    });

    if (activeCategory) {
      params.set('category', activeCategory);
    }

    for (const tag of activeTags) {
      params.append('tag', tag);
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
        tags: [...activeTags],
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
    activeTags,
    allPosts,
  ]);

  useEffect(() => {
    void fetchPostsForFilters();
  }, [fetchPostsForFilters]);

  /**
   * Append another page of posts while ensuring responses correspond to the
   * filters that triggered them (protects against race conditions).
   */
  const loadMorePosts = useCallback(async () => {
    if (isFetching || !postsState.hasMore) {
      return;
    }

    const { category: currentCategory, tags: currentTags } = postsState;

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

      for (const tag of currentTags) {
        params.append('tag', tag);
      }

      const response = await fetch(`/api/posts?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as PaginatedPostsApiResponse;

      setPostsState((previous) => {
        // Ignore responses that were requested with outdated filters.
        if (!filtersMatch(previous, currentCategory, currentTags)) {
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
          tags: [...currentTags],
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

    // Trigger `loadMorePosts` once the sentinel is near the viewport.
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
          <Posts
            posts={postsState.posts}
            hasMoreCol={false}
            activeCategory={postsState.category}
            activeTags={postsState.tags}
          />
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
                  if (activeCategory || activeTags.length) {
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

/**
 * Fetch the static payload required to render the home page. Runs at build
 * time (and revalidates) so the initial render is always hydrated with posts
 * and metadata before client-side filtering kicks in.
 */
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

/**
 * Append incoming posts while skipping duplicates (e.g. when the backend
 * returns overlapping pages after content updates).
 */
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

/**
 * Checks if a stored state snapshot matches the provided filters.
 * Used to avoid redundant fetches and to discard responses for stale filters.
 */
function filtersMatch(
  state: HomePostsState | null,
  category: string | null,
  tags: string[]
): boolean {
  if (!state) {
    return false;
  }

  if ((state.category ?? null) !== category) {
    return false;
  }

  return areStringArraysEqual(state.tags, tags);
}
