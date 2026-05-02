import { useState } from 'react';
import type { PublicComment } from 'types/cms';
import { CommentComposer } from './CommentComposer';

interface CommentItemProps {
  comment: PublicComment;
  isSubmitting: boolean;
  viewerCanComment: boolean;
  allowReply?: boolean;
  onCreateReply: (parentId: string, content: string) => Promise<void>;
  onUpdate: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '';

  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function CommentItem({
  comment,
  isSubmitting,
  viewerCanComment,
  allowReply = false,
  onCreateReply,
  onUpdate,
  onDelete,
}: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  if (comment.isDeleted) {
    return (
      <div className="py-3 text-sm italic text-gray-400">
        This comment has been deleted.
      </div>
    );
  }

  const showReply =
    allowReply &&
    viewerCanComment &&
    comment.status === 'approved' &&
    !comment.isOwnPending &&
    !isSubmitting;
  const showEdit = comment.viewerCanEdit && !isSubmitting;
  const showDelete = comment.viewerCanDelete && !isSubmitting;

  return (
    <div className="py-3">
      <div className="rounded border border-gray-200 bg-white px-4 py-3">
        {comment.isOwnPending && comment.status === 'pending' ? (
          <div className="mb-3 rounded border border-yellow-200 bg-yellow-50 px-3 py-2">
            <p className="text-xs font-medium text-yellow-700">Awaiting moderation</p>
          </div>
        ) : null}

        {isEditing ? (
          <CommentComposer
            onSubmit={async (content) => {
              await onUpdate(comment.id, content);
              setIsEditing(false);
            }}
            disabled={isSubmitting}
            placeholder="Edit your comment..."
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {comment.author?.fullName ?? 'Anonymous'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDateTime(comment.createdAt)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                  {comment.content}
                </p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {showReply ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsReplying((value) => !value);
                    setIsConfirmingDelete(false);
                    setIsEditing(false);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  {isReplying ? 'Cancel reply' : 'Reply'}
                </button>
              ) : null}
              {showEdit ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    setIsReplying(false);
                    setIsConfirmingDelete(false);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Edit
                </button>
              ) : null}
              {showDelete ? (
                isConfirmingDelete ? (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        await onDelete(comment.id);
                        setIsConfirmingDelete(false);
                      }}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Confirm delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(false)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsConfirmingDelete(true);
                      setIsReplying(false);
                      setIsEditing(false);
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Delete
                  </button>
                )
              ) : null}
            </div>
          </>
        )}

        {isReplying ? (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <CommentComposer
              onSubmit={async (content) => {
                await onCreateReply(comment.id, content);
                setIsReplying(false);
              }}
              disabled={isSubmitting}
              placeholder="Write a reply..."
              onCancel={() => setIsReplying(false)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
