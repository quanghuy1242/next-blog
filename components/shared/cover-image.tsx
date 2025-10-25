import React from 'react';
import cn from 'classnames';
import Link from 'next/link';
import { ResponsiveImage } from 'components/shared/responsive-image';
import { getMediaUrl } from 'common/utils/image';
import type { Media } from 'types/cms';

interface CoverImageProps {
  title?: string | null;
  media: Media | null | undefined;
  slug?: string;
  className?: string;
}

export function CoverImage({ title, media, slug, className }: CoverImageProps) {
  const mediaUrl = getMediaUrl(media);

  if (!mediaUrl) {
    return null;
  }

  const alt = media?.alt || `Cover Image for ${title}` || 'Cover Image';

  const image = (
    <ResponsiveImage
      src={media!}
      alt={alt}
      // Force 2:1 aspect ratio like DatoCMS (1000×500, 2000×1000, etc.)
      width={2000}
      height={1000}
      className={cn('shadow-small', {
        'hover:shadow-medium transition-shadow duration-200': slug,
      })}
      priority={!slug} // Priority for non-linked images (usually hero images)
      // Full range of widths for all breakpoints
      // Mobile will use 480/640, Tablet 750/828, Desktop 1080+
      widths={[480, 640, 750, 828, 1080, 1200]}
      // Key: Tell browser the ACTUAL CSS display size at each breakpoint
      // Mobile: ~380px CSS pixels, browser picks based on DPR
      // On 2x display: 380*2=760, browser should pick 750w or 828w
      // But we tell it the image displays at 90vw (342px), so 342*2=684 -> picks 750w
      sizes="(max-width: 640px) 90vw, (max-width: 768px) 45vw, (max-width: 1024px) 45vw, 30vw"
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
