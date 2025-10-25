import React from 'react';
import { PLACEHOLDER_BANNER_URL } from 'common/constants';
import { getMediaUrl } from 'common/utils/image';
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
  const bannerUrl = getMediaUrl(imageBanner) || PLACEHOLDER_BANNER_URL;
  const bannerAlt = imageBanner?.alt || 'Banner background';
  const lowResUrl = imageBanner?.lowResUrl;

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
      {/* Background image - use optimizedUrl directly with CSS */}
      {lowResUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={lowResUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-bottom"
          style={{
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
            aspectRatio: '2 / 1', // Mimic 2000x1000 (2:1) wide effect
          }}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bannerUrl}
        alt={bannerAlt}
        loading="eager"
        fetchPriority="high"
        className="absolute inset-0 w-full h-full object-cover object-bottom"
        style={{
          aspectRatio: '2000 / 800',
        }}
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
