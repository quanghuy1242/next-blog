import React from 'react';
import Link from 'next/link';
import cn from 'classnames';
import type { LinkProps } from 'next/link';
import type { Media } from 'types/cms';
import { ResponsiveImage } from './responsive-image';

const BOOK_COVER_WIDTH = 1026;
const BOOK_COVER_HEIGHT = 1500;

const BOOK_COVER_SIZES = '(max-width: 640px) 90vw, (max-width: 1024px) 40vw, 320px';

interface BookCoverProps {
  media?: Media | null;
  title: string;
  className?: string;
  priority?: boolean;
  href?: LinkProps['href'];
}

export function BookCover({
  media = null,
  title,
  className,
  priority = false,
  href,
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

  if (!href) {
    return cover;
  }

  return (
    <Link href={href} className="block">
      {cover}
    </Link>
  );
}