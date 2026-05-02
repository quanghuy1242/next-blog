import React from 'react';
import { render, screen } from '@testing-library/react';
import { CommentItem } from 'components/shared/comments/CommentItem';
import type { PublicComment } from 'types/cms';

function createComment(overrides: Partial<PublicComment> = {}): PublicComment {
  return {
    id: overrides.id ?? '1',
    content: overrides.content ?? 'Pending comment body',
    status: overrides.status ?? 'approved',
    createdAt: overrides.createdAt ?? '2024-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2024-01-01T00:00:00.000Z',
    parentCommentId: overrides.parentCommentId ?? null,
    chapterId: overrides.chapterId ?? '10',
    postId: overrides.postId ?? null,
    isOwnPending: overrides.isOwnPending ?? false,
    isDeleted: overrides.isDeleted ?? false,
    viewerCanEdit: overrides.viewerCanEdit ?? false,
    viewerCanDelete: overrides.viewerCanDelete ?? false,
    editWindowEndsAt: overrides.editWindowEndsAt ?? null,
    author: overrides.author ?? {
      id: 1,
      fullName: 'Reader One',
      avatar: null,
    },
  };
}

describe('CommentItem', () => {
  test('renders a compact pending badge instead of the old moderation box', () => {
    render(
      <CommentItem
        comment={createComment({ status: 'pending', isOwnPending: true })}
        isSubmitting={false}
        viewerCanComment
        onCreateReply={async () => {}}
        onUpdate={async () => {}}
        onDelete={async () => {}}
      />
    );

    expect(screen.getByLabelText('Pending moderation')).toBeInTheDocument();
    expect(screen.queryByText('Awaiting moderation')).not.toBeInTheDocument();
  });
});
