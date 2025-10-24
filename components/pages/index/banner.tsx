import React from 'react';
import Image from 'next/image';
import { HOME_OG_IMAGE_URL } from 'common/constants';
import { getCoverImageUrl, getBlurPlaceholder } from 'common/utils/image';
import cn from 'classnames';

interface BannerProps {
  header?: string | null;
  subHeader?: string | null;
  className?: string;
}

export function Banner({
  header = '',
  subHeader = '',
  className,
}: BannerProps) {
  // Apply R2 transformations for optimized banner image
  const optimizedImageUrl = getCoverImageUrl(HOME_OG_IMAGE_URL, 2000, 800, 75);
  const blurDataURL = getBlurPlaceholder(HOME_OG_IMAGE_URL);

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
        alt="Banner background"
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
