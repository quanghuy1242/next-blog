import { renderHook, act, waitFor } from '@testing-library/react';
import { useHomePosts } from 'hooks/useHomePosts';
import type { Post } from 'types/cms';
import type { HomePostsState } from 'context/state';
import { vi } from 'vitest';

function createPost(slug: string): Post {
  return {
    id: 1,
    slug,
    title: slug,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    excerpt: null,
    content: null,
    coverImage: null,
    author: null,
    category: null,
    tags: null,
    meta: null,
    _status: 'published',
  };
}

function createState(overrides: Partial<HomePostsState>): HomePostsState {
  return {
    posts: [createPost('initial')],
    offset: 1,
    hasMore: true,
    category: null,
    tags: [],
    ...overrides,
  };
}

describe('useHomePosts', () => {
  const initialPosts = [createPost('initial')];
  const pageSize = 5;

  test('hydrates from context when filters match', async () => {
    const contextState = createState({ category: 'story', tags: [] });
    const setHomePosts = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ posts: [] }),
    });

    const { result } = renderHook(() =>
      useHomePosts({
        initialPosts,
        pageSize,
        activeCategory: 'story',
        activeTags: [],
        routerReady: true,
        homePosts: contextState,
        setHomePosts,
        fetchImplementation: fetchMock as unknown as typeof fetch,
      })
    );

    await waitFor(() => {
      expect(result.current.postsState).toBe(contextState);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.hasActiveFilters).toBe(true);
  });

  test('resets to initial posts when no filters active', async () => {
    const setHomePosts = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ posts: [] }),
    });

    const { result } = renderHook(() =>
      useHomePosts({
        initialPosts,
        pageSize,
        activeCategory: null,
        activeTags: [],
        routerReady: true,
        homePosts: null,
        setHomePosts,
        fetchImplementation: fetchMock as unknown as typeof fetch,
      })
    );

    await waitFor(() => {
      expect(result.current.postsState.posts).toEqual(initialPosts);
    });

    expect(result.current.hasActiveFilters).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('initial state respects provided filters metadata', () => {
    const setHomePosts = vi.fn();
    const fetchMock = vi.fn();

    const { result } = renderHook(() =>
      useHomePosts({
        initialPosts,
        pageSize,
        activeCategory: null,
        activeTags: [],
        initialCategory: 'story',
        initialTags: ['tech'],
        initialHasMore: false,
        routerReady: false,
        homePosts: null,
        setHomePosts,
        fetchImplementation: fetchMock as unknown as typeof fetch,
      })
    );

    expect(result.current.postsState.category).toBe('story');
    expect(result.current.postsState.tags).toEqual(['tech']);
    expect(result.current.postsState.hasMore).toBe(false);
  });

  test('fetches posts when filters change', async () => {
    const setHomePosts = vi.fn();
    const responseData = {
      posts: [createPost('filtered')],
      hasMore: false,
      nextOffset: 1,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => responseData,
    });

    const { result } = renderHook(() =>
      useHomePosts({
        initialPosts,
        pageSize,
        activeCategory: 'story',
        activeTags: ['tech'],
        routerReady: true,
        homePosts: null,
        setHomePosts,
        fetchImplementation: fetchMock as unknown as typeof fetch,
      })
    );

    await waitFor(() => {
      expect(result.current.postsState.posts).toEqual(responseData.posts);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('category=story')
    );
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('tag=tech'));
    expect(setHomePosts).toHaveBeenCalledWith({
      posts: responseData.posts,
      offset: responseData.nextOffset,
      hasMore: responseData.hasMore,
      category: 'story',
      tags: ['tech'],
    });
  });

  test('appends posts when loadMorePosts is called', async () => {
    const existingState = createState({
      posts: [createPost('initial')],
      offset: 1,
      hasMore: true,
      category: 'story',
      tags: ['tech'],
    });
    const setHomePosts = vi.fn();
    const responseData = {
      posts: [createPost('next')],
      hasMore: false,
      nextOffset: 2,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => responseData });

    const { result } = renderHook(() =>
      useHomePosts({
        initialPosts,
        pageSize,
        activeCategory: 'story',
        activeTags: ['tech'],
        routerReady: true,
        homePosts: existingState,
        setHomePosts,
        fetchImplementation: fetchMock as unknown as typeof fetch,
      })
    );

    await act(async () => {
      await result.current.loadMorePosts();
    });

    await waitFor(() => {
      expect(result.current.postsState.posts.map((post) => post.slug)).toEqual([
        'initial',
        'next',
      ]);
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('offset=1'));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('category=story')
    );
    expect(result.current.postsState.hasMore).toBe(false);
  });

  test('exposes error when fetch fails', async () => {
    const setHomePosts = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    const initialProps = {
      initialPosts,
      pageSize,
      activeCategory: 'story',
      activeTags: [],
      routerReady: false,
      homePosts: null,
      setHomePosts,
      fetchImplementation: fetchMock as unknown as typeof fetch,
    };

    const { result, rerender } = renderHook((props) => useHomePosts(props), {
      initialProps,
    });

    await act(async () => {
      rerender({ ...initialProps, routerReady: true });
    });

    await act(async () => {
      await result.current.refetchCurrentFilters();
    });

    await waitFor(() => {
      expect(result.current.error).toBe(
        'Unable to load posts for this filter. Tap to retry.'
      );
    });
  });
});
