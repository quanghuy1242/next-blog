import React from 'react';
import Image from 'next/image';
import { PLACEHOLDER_BANNER_URL } from 'common/constants';
import { getCoverImageUrl, getBlurPlaceholder } from 'common/utils/image';
import type { Media } from 'types/cms';
import cn from 'classnames';

interface BannerProps {
  header?: string | null;
  subHeader?: string | null;
  imageBanner?: Media | null;
  className?: string;
}

export function Banner({
  header = '',
  subHeader = '',
  imageBanner = null,
  className,
}: BannerProps) {
  // Use imageBanner from Homepage, fallback to placeholder
  const bannerUrl = imageBanner?.url || PLACEHOLDER_BANNER_URL;
  const bannerAlt = imageBanner?.alt || 'Banner background';

  // Apply R2 transformations for optimized banner image
  const optimizedImageUrl = getCoverImageUrl(bannerUrl, 2000, 800, 75);
  const blurDataURL = getBlurPlaceholder(bannerUrl);

  return (
    <div
      className={cn(
        'flex flex-col justify-center items-center',
        'h-banner',
        'text-white text-center',
        'relative overflow-hidden',
        className
      )}
    >
      {/* Background image with Next.js Image optimization */}
      <Image
        src={optimizedImageUrl}
        alt={bannerAlt}
        fill
        className="object-cover object-bottom"
        placeholder="blur"
        blurDataURL={blurDataURL}
        priority // Homepage banner should load with priority
        unoptimized // R2 handles transformations
      />
      <div className="z-10 relative">
        <h1 className="text-7xl font-thin" style={{ lineHeight: '3.5rem' }}>
          {header}
        </h1>
        <p className="mt-8 m-3">{subHeader}</p>
      </div>
    </div>
  );
}
