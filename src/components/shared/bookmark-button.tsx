import type { BookmarkRecord } from '@/types/cms';
import { BookmarkButtonClient } from './bookmark-button-client';
import { BookmarkIcon } from './bookmark-icon';
import { Button } from '@/components/ui/aria/button';

interface BookmarkButtonProps {
  contentType: 'chapter' | 'book';
  contentId: number;
  isAuthenticated: boolean;
  initialBookmark?: BookmarkRecord | null;
  initialStateLoaded?: boolean;
}

export function BookmarkButton({
  contentType,
  contentId,
  isAuthenticated,
  initialBookmark = null,
  initialStateLoaded = true,
}: BookmarkButtonProps) {
  if (!isAuthenticated) {
    return null;
  }

  if (!initialStateLoaded) {
    return (
      <Button
        type="button"
        isDisabled
        variant="secondary"
        size="lg"
        className="gap-1.5"
        aria-label="Loading bookmark state"
      >
        <BookmarkIcon filled={false} />
        <span>Bookmark</span>
      </Button>
    );
  }

  return (
    <BookmarkButtonClient
      contentType={contentType}
      contentId={contentId}
      initialBookmark={initialBookmark}
    />
  );
}
