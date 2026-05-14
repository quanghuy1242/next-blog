import type { BookmarkRecord } from '@/types/cms';
import { BookmarkButtonClient } from './bookmark-button-client';

interface BookmarkButtonProps {
  contentType: 'chapter' | 'book';
  contentId: number;
  isAuthenticated: boolean;
  initialBookmark?: BookmarkRecord | null;
}

export function BookmarkButton({
  contentType,
  contentId,
  isAuthenticated,
  initialBookmark = null,
}: BookmarkButtonProps) {
  if (!isAuthenticated) {
    return null;
  }

  return (
    <BookmarkButtonClient
      contentType={contentType}
      contentId={contentId}
      initialBookmark={initialBookmark}
    />
  );
}
