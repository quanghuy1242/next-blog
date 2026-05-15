import React from 'react';
import cn from 'classnames';
import { Bookmark } from 'lucide-react';
import type { Media } from '@/types/cms';
import { ResponsiveImageMarkup } from './responsive-image-markup';
import { TextLink } from '@/components/ui/aria/link';
import { Badge } from '@/components/ui/surface/badge';

const BOOK_COVER_WIDTH = 1026;
const BOOK_COVER_HEIGHT = 1500;

const BOOK_COVER_SIZES = '(max-width: 640px) 90vw, (max-width: 1024px) 40vw, 320px';

interface BookCoverProps {
  media?: Media | null;
  title: string;
  className?: string;
  priority?: boolean;
  href?: string;
  isBookmarked?: boolean;
  readingProgressPct?: number | null;
}

export function BookCover({
  media = null,
  title,
  className,
  priority = false,
  href,
  isBookmarked = false,
  readingProgressPct = null,
}: BookCoverProps) {
  const fallbackStyles = {
    aspectRatio: `${BOOK_COVER_WIDTH} / ${BOOK_COVER_HEIGHT}`,
  } as const;

  const cover = media ? (
    <ResponsiveImageMarkup
      src={media}
      alt={`Cover image for ${title}`}
      width={BOOK_COVER_WIDTH}
      height={BOOK_COVER_HEIGHT}
      priority={priority}
      sizes={BOOK_COVER_SIZES}
      simple={true}
      className={cn('overflow-hidden rounded-sm shadow-small', className)}
    />
  ) : (
    <div
      className={cn(
        'overflow-hidden rounded-sm bg-gradient-to-br from-blue to-darkBlue shadow-small',
        className
      )}
      style={fallbackStyles}
    />
  );

  const coverWithIndicator = (
    <div className="relative">
      {cover}
      {typeof readingProgressPct === 'number' && readingProgressPct > 0 ? (
        <Badge className="pointer-events-none absolute left-2 top-2 min-w-11 justify-center bg-base-100/95 px-2 py-1 text-[11px] font-semibold tabular-nums text-base-content shadow-small">
          {readingProgressPct}%
        </Badge>
      ) : null}
      {isBookmarked ? (
        <Badge
          variant="primary"
          className="pointer-events-none absolute right-2 top-2 h-8 w-8 justify-center rounded-full p-0 shadow-small"
        >
          <Bookmark aria-hidden className="h-4 w-4 fill-current" />
        </Badge>
      ) : null}
    </div>
  );

  if (!href) {
    return coverWithIndicator;
  }

  return (
    <TextLink href={href} prefetch={false} className="block no-underline hover:no-underline">
      {coverWithIndicator}
    </TextLink>
  );
}
