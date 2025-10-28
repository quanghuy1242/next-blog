'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Posts } from 'components/shared/posts';
import { useIntersectionObserver } from 'hooks/useIntersectionObserver';
import { getMorePosts } from '../actions';
import type { Post } from 'types/cms';

interface InfinitePostListProps {
  initialPosts: Post[];
  initialHasMore: boolean;
  category: string | null;
  tags: string[];
}

const POSTS_PAGE_SIZE = 5;

export function InfinitePostList({
  initialPosts,
  initialHasMore,
  category,
  tags,
}: InfinitePostListProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const loadMorePosts = useCallback(async () => {
    if (isFetching || !hasMore) return;

    setIsFetching(true);
    setError(null);

    try {
      const data = await getMorePosts(
        POSTS_PAGE_SIZE,
        posts.length,
        category || undefined,
        tags.length ? tags[0] : undefined
      );

      setPosts((prev) => [...prev, ...data.posts]);
      setHasMore(data.hasMore);

      // Update page param
      const page = Math.ceil(
        (posts.length + data.posts.length) / POSTS_PAGE_SIZE
      );
      const url = new URL(window.location.href);
      url.searchParams.set('page', page.toString());
      router.replace(url.pathname + url.search, { scroll: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsFetching(false);
    }
  }, [isFetching, hasMore, posts.length, category, tags, router]);

  const { ref: loaderRef, isIntersecting } =
    useIntersectionObserver<HTMLDivElement>({
      rootMargin: '200px 0px',
      enabled: hasMore,
    });

  useEffect(() => {
    if (isIntersecting && hasMore) {
      void loadMorePosts();
    }
  }, [isIntersecting, hasMore, loadMorePosts]);

  return (
    <>
      <Posts
        posts={posts}
        hasMoreCol={false}
        activeCategory={category}
        activeTags={tags}
      />
      {!isFetching && !error && posts.length === 0 && (
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
            onClick={() => void loadMorePosts()}
            className="mt-2 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:border-gray-400 hover:text-gray-900"
          >
            Try again
          </button>
        </div>
      )}
      {!hasMore && !isFetching && (
        <p className="my-6 text-center text-sm text-gray-500">
          You&apos;ve reached the end.
        </p>
      )}
    </>
  );
}
