import type { CommentsResult } from 'types/cms';
import { useComments } from 'hooks/useComments';
import { CommentComposer } from './CommentComposer';
import { CommentThread } from './CommentThread';

interface CommentsSectionProps {
  chapterId?: string;
  postId?: string;
  viewerCanComment?: boolean;
  initialData?: CommentsResult | null;
}

export function CommentsSection({
  chapterId,
  postId,
  viewerCanComment: initialViewerCanComment,
  initialData,
}: CommentsSectionProps) {
  const { data, loading, error, createComment, updateComment, deleteComment, isSubmitting } = useComments({
    chapterId,
    postId,
    enabled: true,
  });

  const comments = data?.docs ?? initialData?.docs ?? [];
  const totalDocs = data?.totalDocs ?? initialData?.totalDocs ?? 0;
  const viewerCanComment = data?.viewerCanComment ?? initialViewerCanComment ?? false;

  return (
    <section className="mt-12 border-t border-gray-200 pt-8">
      <h2 className="text-xl font-bold text-gray-900">
        Comments {totalDocs > 0 ? `(${totalDocs})` : ''}
      </h2>

      {viewerCanComment ? (
        <div className="mt-4">
          <CommentComposer
            onSubmit={async (content) => {
              await createComment({ content });
            }}
            disabled={isSubmitting}
            placeholder="Write a comment..."
          />
        </div>
      ) : null}

      {loading && comments.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">Loading comments...</p>
      ) : error && comments.length === 0 ? (
        <p className="mt-6 text-sm text-red-500">{error}</p>
      ) : comments.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No comments yet.</p>
      ) : (
        <div className="mt-6 space-y-6">
          <CommentThread
            comments={comments}
            isSubmitting={isSubmitting}
            viewerCanComment={viewerCanComment}
            onCreateReply={async (parentCommentId, content) => {
              await createComment({ content, parentCommentId });
            }}
            onUpdate={updateComment}
            onDelete={deleteComment}
          />
        </div>
      )}
    </section>
  );
}
