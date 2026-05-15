import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommentsResult } from '@/types/cms';

const COMMENT_FOCUS_REFRESH_INTERVAL_MS = 30_000;

interface UseCommentsOptions {
  chapterId?: string;
  postId?: string;
  enabled?: boolean;
  initialData?: CommentsResult | null;
  refreshOnMount?: boolean;
}

interface UseCommentsState {
  data: CommentsResult | null;
  loading: boolean;
  error: string | null;
  isSubmitting: boolean;
}

export function useComments({
  chapterId,
  postId,
  enabled = true,
  initialData = null,
  refreshOnMount = true,
}: UseCommentsOptions) {
  const lastLoadedAtRef = useRef(0);
  const [state, setState] = useState<UseCommentsState>({
    data: initialData,
    loading: false,
    error: null,
    isSubmitting: false,
  });

  const reload = useCallback(async () => {
    if (!enabled) return;
    if (!chapterId && !postId) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const params = new URLSearchParams();
      if (chapterId) params.set('chapterId', chapterId);
      if (postId) params.set('postId', postId);

      // Comments are live social state, not page content. The route also sends
      // no-store headers; this keeps browser fetch behavior aligned with that
      // contract so newly created/approved comments are not replayed stale.
      const response = await fetch(`/api/comments?${params}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load comments');
      }

      const result: CommentsResult = await response.json();
      lastLoadedAtRef.current = Date.now();
      setState({ data: result, loading: false, error: null, isSubmitting: false });
    } catch {
      setState((prev) => ({ ...prev, loading: false, error: 'Failed to load comments' }));
    }
  }, [chapterId, postId, enabled]);

  useEffect(() => {
    if (!refreshOnMount && initialData) {
      lastLoadedAtRef.current = Date.now();
      return;
    }

    reload();
  }, [initialData, refreshOnMount, reload]);

  useEffect(() => {
    if (!enabled || (!chapterId && !postId)) {
      return;
    }

    const refreshAfterTabReturn = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }

      if (Date.now() - lastLoadedAtRef.current < COMMENT_FOCUS_REFRESH_INTERVAL_MS) {
        return;
      }

      void reload();
    };

    // The API is no-store, but an already-open comment list still needs an
    // explicit refresh to see comments created or approved from another tab or
    // device. Focus/visibility keeps that fresh without adding polling.
    window.addEventListener('focus', refreshAfterTabReturn);
    document.addEventListener('visibilitychange', refreshAfterTabReturn);

    return () => {
      window.removeEventListener('focus', refreshAfterTabReturn);
      document.removeEventListener('visibilitychange', refreshAfterTabReturn);
    };
  }, [chapterId, enabled, postId, reload]);

  const createComment = useCallback(async (
    input: { content: string; parentCommentId?: string }
  ) => {
    setState((prev) => ({ ...prev, isSubmitting: true }));

    try {
      const body: Record<string, string> = { content: input.content };
      if (chapterId) body.chapterId = chapterId;
      if (postId) body.postId = postId;
      if (input.parentCommentId) body.parentCommentId = input.parentCommentId;

      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Failed to create comment');
      }

      await reload();
    } catch {
      setState((prev) => ({ ...prev, error: 'Failed to create comment' }));
    } finally {
      setState((prev) => ({ ...prev, isSubmitting: false }));
    }
  }, [chapterId, postId, reload]);

  const updateComment = useCallback(async (commentId: string, content: string) => {
    setState((prev) => ({ ...prev, isSubmitting: true }));

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error('Failed to update comment');
      }

      await reload();
    } catch {
      setState((prev) => ({ ...prev, error: 'Failed to update comment' }));
    } finally {
      setState((prev) => ({ ...prev, isSubmitting: false }));
    }
  }, [reload]);

  const deleteComment = useCallback(async (commentId: string) => {
    setState((prev) => ({ ...prev, isSubmitting: true }));

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }

      await reload();
    } catch {
      setState((prev) => ({ ...prev, error: 'Failed to delete comment' }));
    } finally {
      setState((prev) => ({ ...prev, isSubmitting: false }));
    }
  }, [reload]);

  return {
    ...state,
    reload,
    createComment,
    updateComment,
    deleteComment,
  };
}
