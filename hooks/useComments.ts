import { useCallback, useEffect, useState } from 'react';
import type { CommentsResult } from 'types/cms';

interface UseCommentsOptions {
  chapterId?: string;
  postId?: string;
  enabled?: boolean;
}

interface UseCommentsState {
  data: CommentsResult | null;
  loading: boolean;
  error: string | null;
  isSubmitting: boolean;
}

export function useComments({ chapterId, postId, enabled = true }: UseCommentsOptions) {
  const [state, setState] = useState<UseCommentsState>({
    data: null,
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

      const response = await fetch(`/api/comments?${params}`);
      if (!response.ok) {
        throw new Error('Failed to load comments');
      }

      const result: CommentsResult = await response.json();
      setState({ data: result, loading: false, error: null, isSubmitting: false });
    } catch {
      setState((prev) => ({ ...prev, loading: false, error: 'Failed to load comments' }));
    }
  }, [chapterId, postId, enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

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