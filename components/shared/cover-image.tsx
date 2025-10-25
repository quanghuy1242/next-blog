import React from 'react';
import cn from 'classnames';
import Link from 'next/link';
import { ResponsiveImage } from 'components/shared/responsive-image';
import type { Media } from 'types/cms';

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

  const alt = media.alt || `Cover Image for ${title}` || 'Cover Image';

  const image = (
    <ResponsiveImage
      src={media.url}
      alt={alt}
      lowResUrl={media.lowResUrl}
      // Force 2:1 aspect ratio like DatoCMS (1000×500, 2000×1000, etc.)
      width={2000}
      height={1000}
      className={cn('shadow-small', {
        'hover:shadow-medium transition-shadow duration-200': slug,
      })}
      priority={!slug} // Priority for non-linked images (usually hero images)
      // Responsive sizes optimized for actual display dimensions
      // Mobile: ~380px (with container padding), Tablet: ~45vw, Desktop: ~30vw
      sizes="(max-width: 640px) 640px, (max-width: 768px) 750px, (max-width: 1024px) 828px, (max-width: 1280px) 640px, 828px"
      quality={75}
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
