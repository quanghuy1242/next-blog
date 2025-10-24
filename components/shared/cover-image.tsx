import React from 'react';
import cn from 'classnames';
import Link from 'next/link';
import Image from 'next/image';
import type { Media } from 'types/cms';
import { getCoverImageUrl, getBlurPlaceholder } from 'common/utils/image';

interface CoverImageProps {
  title?: string | null;
  media: Media | null | undefined;
  slug?: string;
  className?: string;
}

export function CoverImage({ title, media, slug, className }: CoverImageProps) {
  if (!media?.url) {
    return null;
  }

  const imageUrl = getCoverImageUrl(media.url, 2000, 1000, 75);
  const blurDataURL = getBlurPlaceholder(media.url);
  const alt = media.alt || `Cover Image for ${title}` || 'Cover Image';

  const image = (
    <Image
      src={imageUrl}
      alt={alt}
      width={media.width || 2000}
      height={media.height || 1000}
      className={cn('shadow-small', {
        'hover:shadow-medium transition-shadow duration-200': slug,
      })}
      priority={!slug} // Priority for non-linked images (usually hero images)
      placeholder="blur" // Enable blur placeholder
      blurDataURL={blurDataURL} // Low-quality blurred image from R2
      unoptimized // R2 handles all transformations via URL parameters
    />
  );

  return (
    <div className={cn('sm:mx-0', className)}>
      {slug ? (
        <Link
          href={`/posts/${slug}`}
          aria-label={title ?? 'Post cover'}
          className="block"
        >
          {image}
        </Link>
      ) : (
        image
      )}
    </div>
  );
}
