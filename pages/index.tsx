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
    }),
    [allPosts]
  );

  const { homePosts, setHomePosts } = useAppContext();
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const hasHydratedFromContext = useRef(false);

  const [postsState, setPostsState] = useState<HomePostsState>(
    () => homePosts ?? initialState
  );
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasHydratedFromContext.current && homePosts) {
      hasHydratedFromContext.current = true;
      setPostsState(homePosts);
      return;
    }

    if (postsState !== homePosts) {
      setHomePosts(postsState);
    }
  }, [homePosts, postsState, setHomePosts]);

  const loadMorePosts = useCallback(async () => {
    if (isFetching || !postsState.hasMore) {
      return;
    }

    setIsFetching(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/posts?offset=${postsState.offset}&limit=${POSTS_PAGE_SIZE}`
      );

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as PaginatedPostsApiResponse;

      setPostsState((previous) => {
        const mergedPosts = mergePosts(previous.posts, payload.posts ?? []);

        const nextOffset = Math.max(
          payload.nextOffset ?? previous.offset,
          mergedPosts.length
        );

        return {
          posts: mergedPosts,
          offset: nextOffset,
          hasMore: payload.hasMore ?? previous.hasMore,
        };
      });
    } catch (loadError) {
      console.error('Failed to load more posts', loadError);
      setError('Unable to load more posts right now. Tap to retry.');
    } finally {
      setIsFetching(false);
    }
  }, [isFetching, postsState.hasMore, postsState.offset]);

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
          <div ref={loaderRef} className="h-1 w-full" aria-hidden />
          {isFetching && (
            <div className="mt-6 flex justify-center">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
            </div>
          )}
          {error && (
            <div className="mt-4 flex flex-col items-center text-center">
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => void loadMorePosts()}
                className="mt-2 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:border-gray-400 hover:text-gray-900"
              >
                Try again
              </button>
            </div>
          )}
          {!postsState.hasMore && !isFetching && (
            <p className="mt-6 text-center text-sm text-gray-500">
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
