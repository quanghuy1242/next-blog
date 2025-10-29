'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIntersectionObserver } from 'hooks/useIntersectionObserver';
import { Posts } from 'components/shared/posts';
import type { Post } from 'types/cms';
import { useRouter, useSearchParams } from 'next/navigation';

interface InfinitePostListProps {
  initialPosts: Post[];
  initialHasMore: boolean;
  category: string | null;
  tags: string[];
  pageSize: number;
}

export default function InfinitePostList({
  initialPosts,
  initialHasMore,
  category,
  tags,
  pageSize,
}: InfinitePostListProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [offset, setOffset] = useState<number>(initialPosts.length);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Keep page param in sync for back/forward scroll positions
  useEffect(() => {
    const page = Math.max(1, Math.ceil(offset / Math.max(pageSize, 1)));
    const sp = new URLSearchParams(searchParams?.toString());
    sp.set('page', String(page));
    router.replace(`/?${sp.toString()}`, { scroll: false });
  }, [offset, pageSize, router, searchParams]);

  const { ref: loaderRef, isIntersecting } = useIntersectionObserver({
    rootMargin: '200px 0px',
    enabled: hasMore,
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(offset),
    });
    if (category) params.set('category', category);
    for (const t of tags) params.append('tag', t);
    return params.toString();
  }, [category, tags, pageSize, offset]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts?${queryString}`);
      if (!res.ok) throw new Error(`Failed with ${res.status}`);
      const data: { posts?: Post[]; hasMore?: boolean; nextOffset?: number } =
        await res.json();
      const incoming = data.posts ?? [];
      setPosts((prev) => mergePosts(prev, incoming));
      setHasMore(Boolean(data.hasMore));
      setOffset((prev) =>
        Math.max(
          data.nextOffset ?? prev + incoming.length,
          prev + incoming.length
        )
      );
    } catch {
      setError('Unable to load more posts right now.');
    } finally {
      setIsLoading(false);
    }
  }, [queryString, isLoading, hasMore]);

  useEffect(() => {
    if (isIntersecting) void loadMore();
  }, [isIntersecting, loadMore]);

  if (!hasMore && posts.length === initialPosts.length) {
    // No more data beyond initial - don't render controls
    return null;
  }

  return (
    <div>
      {/* Sentinel for infinite scroll */}
      <div
        ref={loaderRef as React.RefObject<HTMLDivElement>}
        className="h-1 w-full"
        aria-hidden
      />
      {isLoading && (
        <div className="my-6 flex justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
        </div>
      )}
      {error && (
        <div className="mt-4 flex flex-col items-center text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => void loadMore()}
            className="mt-2 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:border-gray-400 hover:text-gray-900"
          >
            Try again
          </button>
        </div>
      )}
      {/* Render appended posts if any beyond initial */}
      {posts.length > initialPosts.length && (
        <Posts
          posts={posts.slice(initialPosts.length)}
          hasMoreCol={false}
          activeCategory={category}
          activeTags={tags}
        />
      )}
      {!hasMore && !isLoading && (
        <p className="my-6 text-center text-sm text-gray-500">
          You&apos;ve reached the end.
        </p>
      )}
    </div>
  );
}

function mergePosts(current: Post[], incoming: Post[]): Post[] {
  if (!incoming.length) return current;
  const seen = new Set(current.map((p) => p.slug));
  const merged = [...current];
  for (const p of incoming) {
    if (!seen.has(p.slug)) {
      seen.add(p.slug);
      merged.push(p);
    }
  }
  return merged;
}
