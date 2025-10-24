/**
 * Progressive Responsive Image Component
 *
 * Replicates DatoCMS's progressive image loading behavior:
 * 1. Shows low-quality placeholder immediately (LQIP)
 * 2. Loads full-quality image progressively
 * 3. Uses <picture> element with multiple formats (WebP, AVIF)
 * 4. Supports responsive srcSet for different screen sizes
 */

import React, { useState } from 'react';
import {
  generateResponsiveImage,
  getBlurPlaceholder,
} from 'common/utils/image';
import cn from 'classnames';

export interface ResponsiveImageProps {
  src: string;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  className?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  objectPosition?: string;
  priority?: boolean;
}

export function ResponsiveImage({
  src,
  alt = '',
  width = null,
  height = null,
  className,
  objectFit = 'cover',
  objectPosition = 'center',
  priority = false,
}: ResponsiveImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  const imageData = generateResponsiveImage(src, {
    width,
    height,
    alt: alt ?? undefined,
    quality: 75,
    includeAvif: true,
  });

  // Get low-res blurred placeholder using Cloudflare transformations
  // This loads a tiny ~20px wide, heavily blurred image
  const blurPlaceholder = getBlurPlaceholder(src);

  if (!imageData) {
    return null;
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* LQIP Background - tiny blurred image from Cloudflare */}
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-300',
          isLoaded ? 'opacity-0' : 'opacity-100'
        )}
        style={{
          backgroundImage: `url("${blurPlaceholder}")`,
          backgroundSize: 'cover',
          backgroundPosition: objectPosition,
          filter: 'blur(20px)',
          transform: 'scale(1.1)', // Slightly scale up to hide blur edges
        }}
      />

      {/* Progressive Image with <picture> for format negotiation */}
      <picture>
        {/* AVIF format - best compression */}
        {imageData.avifSrcSet && (
          <source
            type="image/avif"
            srcSet={imageData.avifSrcSet}
            sizes={imageData.sizes}
          />
        )}

        {/* WebP format - good compression */}
        <source
          type="image/webp"
          srcSet={imageData.webpSrcSet}
          sizes={imageData.sizes}
        />

        {/* JPEG fallback */}
        <img
          src={imageData.src}
          srcSet={imageData.srcSet}
          sizes={imageData.sizes}
          alt={alt || ''}
          width={width || undefined}
          height={height || undefined}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          onLoad={() => setIsLoaded(true)}
          className={cn(
            'transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            objectFit,
            objectPosition,
            width: '100%',
            height: '100%',
          }}
        />
      </picture>
    </div>
  );
}
