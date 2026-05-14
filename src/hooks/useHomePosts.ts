import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { Post } from '@/types/cms';
import {
  buildHomeFeedSnapshotKey,
  readHomeFeedSnapshot,
  writeHomeFeedSnapshot,
  type HomeFeedStateSnapshot,
} from '@/lib/home/home-feed-snapshot';
import { areStringArraysEqual } from '@/lib/utils/query';

interface UseHomePostsParams {
  initialPosts: Post[];
  pageSize: number;
  activeCategory: string | null;
  activeTags: string[];
  initialHasMore?: boolean;
  initialCategory?: string | null;
  initialTags?: string[];
  routerReady: boolean;
  fetchImplementation?: typeof fetch;
}

interface UseHomePostsResult {
  postsState: HomePostsState;
  isFetching: boolean;
  error: string | null;
  hasActiveFilters: boolean;
  loadMorePosts: () => Promise<void>;
  refetchCurrentFilters: () => Promise<void>;
}

interface PaginatedPostsApiResponse {
  posts?: Post[];
  hasMore?: boolean;
  nextOffset?: number;
}

export type HomePostsState = HomeFeedStateSnapshot;

const FILTER_FETCH_ERROR =
  'Unable to load posts for this filter. Tap to retry.';
const LOAD_MORE_ERROR = 'Unable to load more posts right now. Tap to retry.';

export function useHomePosts({
  initialPosts,
  pageSize,
  activeCategory,
  activeTags,
  initialHasMore,
  initialCategory,
  initialTags,
  routerReady,
  fetchImplementation,
}: UseHomePostsParams): UseHomePostsResult {
  const fetchFn = fetchImplementation ?? globalThis.fetch;

  if (!fetchFn) {
    throw new Error('Fetch implementation is required to load posts.');
  }

  const normalizedInitialTags = useMemo(
    () => (initialTags ? [...initialTags] : []),
    [initialTags]
  );

  const initialState = useMemo<HomePostsState>(
    () => ({
      posts: initialPosts,
      offset: initialPosts.length,
      hasMore:
        typeof initialHasMore === 'boolean'
          ? initialHasMore
          : initialPosts.length === pageSize,
      category: initialCategory ?? null,
      tags: [...normalizedInitialTags],
    }),
    [
      initialPosts,
      pageSize,
      initialHasMore,
      initialCategory,
      normalizedInitialTags,
    ]
  );

  const [postsState, setPostsState] = useState<HomePostsState>(
    () => initialState
  );
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedSnapshotKey, setResolvedSnapshotKey] = useState<string | null>(null);

  const hasActiveFilters = Boolean(activeCategory || activeTags.length);
  const snapshotKey = useMemo(
    () => buildHomeFeedSnapshotKey(activeCategory, activeTags),
    [activeCategory, activeTags]
  );

  useLayoutEffect(() => {
    if (!routerReady || resolvedSnapshotKey === snapshotKey) {
      return;
    }

    const snapshot = readHomeFeedSnapshot(activeCategory, activeTags);

    if (snapshot && filtersMatch(snapshot, activeCategory, activeTags)) {
      setPostsState(snapshot);
    } else {
      setPostsState(initialState);
    }

    setResolvedSnapshotKey(snapshotKey);
  }, [
    routerReady,
    activeCategory,
    activeTags,
    initialState,
    resolvedSnapshotKey,
    snapshotKey,
  ]);

  useEffect(() => {
    if (resolvedSnapshotKey !== snapshotKey) {
      return;
    }

    writeHomeFeedSnapshot(postsState);
  }, [postsState, resolvedSnapshotKey, snapshotKey]);

  const fetchPostsForFilters = useCallback(
    async (force = false) => {
      if (!routerReady) {
        return;
      }

      if (resolvedSnapshotKey !== snapshotKey) {
        return;
      }

      if (!force && filtersMatch(postsState, activeCategory, activeTags)) {
        return;
      }

      if (!hasActiveFilters) {
        setPostsState(initialState);
        setIsFetching(false);
        setError(null);
        return;
      }

      const params = new URLSearchParams({
        limit: pageSize.toString(),
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
        const response = await fetchFn(`/api/posts?${params.toString()}`);

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
        setError(FILTER_FETCH_ERROR);
      } finally {
        setIsFetching(false);
      }
    },
    [
      activeCategory,
      activeTags,
      fetchFn,
      hasActiveFilters,
      initialState,
      pageSize,
      postsState,
      resolvedSnapshotKey,
      routerReady,
      snapshotKey,
    ]
  );

  useEffect(() => {
    void fetchPostsForFilters();
  }, [fetchPostsForFilters]);

  const loadMorePosts = useCallback(async () => {
    if (isFetching || !postsState.hasMore) {
      return;
    }

    const currentCategory = postsState.category;
    const currentTags = postsState.tags ?? [];

    const params = new URLSearchParams({
      offset: postsState.offset.toString(),
      limit: pageSize.toString(),
    });

    if (currentCategory) {
      params.set('category', currentCategory);
    }

    for (const tag of currentTags) {
      params.append('tag', tag);
    }

    setIsFetching(true);
    setError(null);

    try {
      const response = await fetchFn(`/api/posts?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as PaginatedPostsApiResponse;

      setPostsState((previous) => {
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
      setError(LOAD_MORE_ERROR);
    } finally {
      setIsFetching(false);
    }
  }, [fetchFn, isFetching, pageSize, postsState]);

  const refetchCurrentFilters = useCallback(async () => {
    await fetchPostsForFilters(true);
  }, [fetchPostsForFilters]);

  return {
    postsState,
    isFetching,
    error,
    hasActiveFilters,
    loadMorePosts,
    refetchCurrentFilters,
  };
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
  tags: string[]
): boolean {
  if (!state) {
    return false;
  }

  if ((state.category ?? null) !== category) {
    return false;
  }

  return areStringArraysEqual(state.tags ?? [], tags);
}
