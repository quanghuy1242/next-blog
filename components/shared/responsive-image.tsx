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
  /**
   * If true, image fills its container (position: absolute)
   * If false, maintains aspect ratio with padding-bottom technique
   */
  fill?: boolean;
  /**
   * Cloudflare gravity parameter - controls crop focal point
   * Maps to objectPosition for consistency
   */
  gravity?: 'auto' | 'left' | 'right' | 'top' | 'bottom' | 'center';
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
  fill = false,
  gravity,
}: ResponsiveImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  // Check if image is already loaded (cached)
  React.useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalHeight !== 0) {
      setIsLoaded(true);
    }
  }, []);

  const imageData = generateResponsiveImage(src, {
    width,
    height,
    alt: alt ?? undefined,
    quality: 80,
    includeAvif: true,
    fit: fill ? 'cover' : 'scale-down', // Cover for banners, scale-down for posts
    gravity: gravity, // Pass gravity for Cloudflare transformation
  });

  if (!imageData) {
    return null;
  }

  // Calculate aspect ratio for maintaining image proportions (only for non-fill mode)
  const aspectRatio =
    !fill && width && height && width > 0 && height > 0
      ? height / width
      : undefined;

  // Get low-res blurred placeholder using Cloudflare transformations
  // This loads a tiny image with the correct aspect ratio, heavily blurred
  const blurPlaceholderWidth = 20;
  const blurPlaceholder = getBlurPlaceholder(src, blurPlaceholderWidth);

  const containerStyles = fill
    ? undefined // Fill mode: no padding, let parent control size
    : aspectRatio
    ? {
        paddingBottom: `${aspectRatio * 100}%`,
        aspectRatio: width && height ? `${width} / ${height}` : undefined,
      }
    : undefined;

  const imageClasses = fill
    ? 'absolute inset-0 w-full h-full' // Fill mode: absolute positioning
    : aspectRatio
    ? 'absolute inset-0 w-full h-full' // Aspect ratio mode: absolute within padded container
    : 'w-full h-auto'; // No aspect ratio: natural sizing

  // In fill mode, don't use relative positioning - let it be controlled by parent
  const containerClasses = fill
    ? 'overflow-hidden'
    : aspectRatio
    ? cn('relative overflow-hidden') // Aspect ratio mode needs relative container
    : ''; // Natural sizing mode doesn't need container wrapper

  const shouldScalePlaceholder =
    objectFit === 'cover' || objectFit === 'fill';

  return (
    <div className={cn(containerClasses, className)} style={containerStyles}>
      {/* LQIP Background - only show for fill/aspect ratio modes */}
      {(fill || aspectRatio) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={blurPlaceholder}
          alt=""
          aria-hidden="true"
          className={cn(
            imageClasses,
            'transition-opacity duration-300',
            isLoaded ? 'opacity-0' : 'opacity-100'
          )}
          style={{
            objectFit, // Use the same objectFit as the main image
            objectPosition,
            filter: 'blur(20px)',
            transform: shouldScalePlaceholder ? 'scale(1.1)' : undefined, // Avoid over-scaling for contain/scale-down
          }}
        />
      )}

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
          ref={imgRef}
          src={imageData.src}
          srcSet={imageData.srcSet}
          sizes={imageData.sizes}
          alt={alt || ''}
          width={width || undefined}
          height={height || undefined}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          onLoad={() => {
            setIsLoaded(true);
          }}
          onError={() => {
            setIsLoaded(true); // Show original even if failed
          }}
          className={cn(
            imageClasses,
            'transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            objectFit,
            objectPosition,
          }}
        />
      </picture>
    </div>
  );
}
