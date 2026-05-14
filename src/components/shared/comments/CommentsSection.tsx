import type { CommentsResult } from '@/types/cms';
import { CommentsSectionClient } from './comments-section-client';

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
  return (
    <CommentsSectionClient
      chapterId={chapterId}
      postId={postId}
      viewerCanComment={initialViewerCanComment}
      initialData={initialData}
    />
  );
}
