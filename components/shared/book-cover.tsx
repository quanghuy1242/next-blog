import React from 'react';
import cn from 'classnames';
import type { Media } from 'types/cms';
import { ResponsiveImage } from './responsive-image';
import { SSRPrefetchLink } from 'components/shared/ssr-prefetch-link';

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
}

export function BookCover({
  media = null,
  title,
  className,
  priority = false,
  href,
  isBookmarked = false,
}: BookCoverProps) {
  const fallbackStyles = {
    aspectRatio: `${BOOK_COVER_WIDTH} / ${BOOK_COVER_HEIGHT}`,
  } as const;

  const cover = media ? (
    <ResponsiveImage
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
      {isBookmarked ? (
        <span className="pointer-events-none absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue text-white shadow-small">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
            />
          </svg>
        </span>
      ) : null}
    </div>
  );

  if (!href) {
    return coverWithIndicator;
  }

  return (
    <SSRPrefetchLink href={href} className="block">
      {coverWithIndicator}
    </SSRPrefetchLink>
  );
}
