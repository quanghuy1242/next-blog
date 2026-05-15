import type { CommentsResult } from '@/types/cms';
import { CommentsSectionClient } from './comments-section-client';

interface CommentsSectionProps {
  chapterId?: string;
  postId?: string;
  viewerCanComment?: boolean;
  initialData?: CommentsResult | null;
  refreshOnMount?: boolean;
}

/**
 * Comments are intentionally a client-hydrated island for cached article and
 * chapter routes. Passing no initialData keeps mutable viewer permissions and
 * fresh comment lists out of the server render's critical path.
 */
export function CommentsSection({
  chapterId,
  postId,
  viewerCanComment: initialViewerCanComment,
  initialData,
  refreshOnMount,
}: CommentsSectionProps) {
  return (
    <CommentsSectionClient
      chapterId={chapterId}
      postId={postId}
      viewerCanComment={initialViewerCanComment}
      initialData={initialData}
      refreshOnMount={refreshOnMount}
    />
  );
}
