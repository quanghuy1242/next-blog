/**
 * Progressive Responsive Image Component
 *
 * Implements progressive image loading with viewport detection:
 * 1. Shows low-quality placeholder immediately (LQIP)
 * 2. Detects when component enters viewport using Intersection Observer
 * 3. Loads full-quality image only when visible
 * 4. Uses <picture> element with multiple formats (WebP, AVIF)
 * 5. Supports responsive srcSet for different screen sizes
 */

import React, { useState } from 'react';
import {
  generateResponsiveImage,
  getBlurPlaceholder,
} from 'common/utils/image';
import { useIntersectionObserver } from 'hooks/useIntersectionObserver';
import cn from 'classnames';
import type { Media } from 'types/cms';

export interface ResponsiveImageProps {
  src: string | Media;
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
  /**
   * Pre-generated low-res base64 data URL for blur placeholder (from backend)
   * If provided, this will be used instead of R2 transformation
   */
  lowResUrl?: string | null;
  /**
   * Fetch priority hint for the browser
   * Use 'high' for LCP (Largest Contentful Paint) images
   */
  fetchPriority?: 'high' | 'low' | 'auto';
  /**
   * Custom sizes attribute for responsive images
   * Helps browser select optimal image size
   */
  sizes?: string;
  /**
   * Image quality (1-100). Lower values = smaller files
   * Default: 80
   */
  quality?: number;
  /**
   * Array of image widths to generate for srcset
   * Smaller arrays = fewer variants = better for mobile
   */
  widths?: number[];
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
  lowResUrl,
  fetchPriority,
  sizes,
  quality,
  widths,
}: ResponsiveImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  // Observe when component enters viewport
  // Use generous rootMargin to start loading slightly before visible
  const { ref: containerRef, isIntersecting } = useIntersectionObserver({
    rootMargin: '200px 0px',
    triggerOnce: true, // Only trigger once, no need to re-observe
  });

  // For priority images, always load immediately
  const shouldLoad = priority || isIntersecting;

  // Check if image is already loaded (cached)
  React.useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalHeight !== 0) {
      setIsLoaded(true);
    }
  }, []);

  // Extract lowResUrl from Media object if src is Media, otherwise use prop
  const actualLowResUrl =
    typeof src === 'object' && src !== null && 'lowResUrl' in src
      ? src.lowResUrl
      : lowResUrl;

  const imageData = generateResponsiveImage(src, {
    width,
    height,
    alt: alt ?? undefined,
    quality: quality ?? 80,
    includeAvif: true,
    // Use 'cover' when dimensions are specified to ensure exact aspect ratio
    // Use 'scale-down' when no dimensions to preserve original
    fit: width && height ? 'cover' : 'scale-down',
    gravity: gravity, // Pass gravity for Cloudflare transformation
    sizes: sizes, // Custom sizes attribute
    widths: widths, // Custom widths for srcset generation
  });

  if (!imageData) {
    return null;
  }

  // Calculate aspect ratio for maintaining image proportions (only for non-fill mode)
  const aspectRatio =
    !fill && width && height && width > 0 && height > 0
      ? height / width
      : undefined;

  // Get low-res blurred placeholder
  // If lowResUrl is provided (base64 from backend), use it directly
  // Otherwise, use Cloudflare R2 transformation with calculated dimensions
  const blurPlaceholderHeight = 20;
  const blurPlaceholderWidth = aspectRatio
    ? Math.round(blurPlaceholderHeight / aspectRatio)
    : 20;
  const blurPlaceholder = getBlurPlaceholder(
    src,
    blurPlaceholderWidth,
    blurPlaceholderHeight,
    20,
    actualLowResUrl
  );

  const containerStyles = fill
    ? undefined // Fill mode: no padding, let parent control size
    : aspectRatio
    ? {
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

  const shouldScalePlaceholder = objectFit === 'cover' || objectFit === 'fill';

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className={cn(containerClasses, className)}
      style={containerStyles}
    >
      {/* LQIP Background - always show until full image loads */}
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

      {/* Progressive Image - only load when in viewport (or priority) */}
      {shouldLoad && (
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
            fetchPriority={fetchPriority}
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
      )}
    </div>
  );
}
