import type { PublicComment } from 'types/cms';
import { CommentItem } from './CommentItem';

interface CommentThreadProps {
  comments: PublicComment[];
  isSubmitting: boolean;
  viewerCanComment: boolean;
  onCreateReply: (parentId: string, content: string) => Promise<void>;
  onUpdate: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}

export function CommentThread({
  comments,
  isSubmitting,
  viewerCanComment,
  onCreateReply,
  onUpdate,
  onDelete,
}: CommentThreadProps) {
  const topLevelComments = comments.filter((comment) => !comment.parentCommentId);
  const repliesByParentId = new Map<string, PublicComment[]>();

  for (const comment of comments) {
    if (!comment.parentCommentId) {
      continue;
    }

    const siblings = repliesByParentId.get(comment.parentCommentId) ?? [];
    siblings.push(comment);
    repliesByParentId.set(comment.parentCommentId, siblings);
  }

  return (
    <div className="space-y-6">
      {topLevelComments.map((comment) => {
        const replies = repliesByParentId.get(comment.id) ?? [];

        return (
          <div key={comment.id}>
            <CommentItem
              comment={comment}
              isSubmitting={isSubmitting}
              viewerCanComment={viewerCanComment}
              allowReply
              onCreateReply={onCreateReply}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
            {replies.length > 0 ? (
              <div className="ml-8 mt-3 space-y-4 border-l border-gray-200 pl-4">
                {replies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    isSubmitting={isSubmitting}
                    viewerCanComment={viewerCanComment}
                    onCreateReply={onCreateReply}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
