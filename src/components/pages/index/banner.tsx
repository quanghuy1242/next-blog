import React from 'react';
import { PLACEHOLDER_BANNER_URL } from '@/lib/domain/home/constants';
import { getMediaUrl } from '@/lib/shared/image';
import type { Media } from '@/types/cms';
import { MediaHero } from '@/components/layout/media-hero';

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
    <MediaHero
      title={header}
      subtitle={subHeader ? <p className="m-3 mt-8">{subHeader}</p> : null}
      imageUrl={bannerUrl}
      imageAlt={bannerAlt}
      lowResUrl={lowResUrl}
      objectPosition="object-top"
      className={className}
      overlay={false}
    />
  );
}
