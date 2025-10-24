import React from 'react';
import { PLACEHOLDER_BANNER_URL } from 'common/constants';
import { ResponsiveImage } from 'components/shared/responsive-image';
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
      {/* Background image with progressive loading */}
      <ResponsiveImage
        src={bannerUrl}
        alt={bannerAlt}
        width={2000}
        height={800}
        objectFit="cover"
        objectPosition="bottom"
        priority={true}
        className="absolute inset-0 w-full h-full"
      />

      {/* Content overlay */}
      <div className="z-10 relative">
        <h1 className="text-7xl font-thin" style={{ lineHeight: '3.5rem' }}>
          {header}
        </h1>
        <p className="mt-8 m-3">{subHeader}</p>
      </div>
    </div>
  );
}
