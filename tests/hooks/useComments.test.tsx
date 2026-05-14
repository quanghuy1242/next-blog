import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { useComments } from '@/hooks/useComments';
import type { CommentsResult } from '@/types/cms';

const initialData: CommentsResult = {
  docs: [
    {
      id: '1',
      content: 'Existing comment',
      status: 'approved',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      parentCommentId: null,
      chapterId: null,
      postId: '10',
      isOwnPending: false,
      isDeleted: false,
      viewerCanEdit: false,
      viewerCanDelete: false,
      editWindowEndsAt: null,
      author: {
        id: 1,
        fullName: 'Reader',
        avatar: null,
      },
    },
  ],
  totalDocs: 1,
  viewerCanComment: false,
};

describe('useComments', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ docs: [], totalDocs: 0, viewerCanComment: true }),
    } as Response);
  });

  test('uses initial data without an initial client reload when disabled', async () => {
    const { result } = renderHook(() =>
      useComments({
        postId: '10',
        initialData,
        refreshOnMount: false,
      })
    );

    expect(result.current.data).toBe(initialData);
    expect(result.current.loading).toBe(false);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('can still refresh initial data on mount', async () => {
    const { result } = renderHook(() =>
      useComments({
        postId: '10',
        initialData,
      })
    );

    await waitFor(() => {
      expect(result.current.data?.viewerCanComment).toBe(true);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/comments?postId=10');
  });
});
