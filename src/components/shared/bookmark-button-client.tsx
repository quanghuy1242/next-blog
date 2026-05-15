'use client';

import cn from 'classnames';

import { useBookmark } from '@/hooks/useBookmark';
import { Button } from '@/components/ui/aria/button';
import type { BookmarkRecord } from '@/types/cms';
import { BookmarkIcon } from './bookmark-icon';

interface BookmarkButtonClientProps {
  contentType: 'chapter' | 'book';
  contentId: number;
  initialBookmark: BookmarkRecord | null;
}

export function BookmarkButtonClient({
  contentType,
  contentId,
  initialBookmark,
}: BookmarkButtonClientProps) {
  const { isBookmarked, isMutating, toggle } = useBookmark({
    contentType,
    contentId,
    enabled: true,
    initialBookmark,
  });

  return (
    <Button
      type="button"
      onPress={toggle}
      isDisabled={isMutating}
      variant={isBookmarked ? 'primary' : 'secondary'}
      size="lg"
      className={cn('gap-1.5', isBookmarked ? 'border border-primary' : '')}
      aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
      aria-pressed={isBookmarked}
    >
      <BookmarkIcon filled={isBookmarked} />
      <span>{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
    </Button>
  );
}
