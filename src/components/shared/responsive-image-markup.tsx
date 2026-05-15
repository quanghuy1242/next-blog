import cn from 'classnames';

import {
  generateResponsiveImage,
  getBlurPlaceholder,
} from '@/lib/shared/image';
import type { Media } from '@/types/cms';

export interface ResponsiveImageMarkupProps {
  src: string | Media;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  className?: string;
  intrinsic?: boolean;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  objectPosition?: string;
  priority?: boolean;
  fill?: boolean;
  gravity?: 'auto' | 'left' | 'right' | 'top' | 'bottom' | 'center';
  lowResUrl?: string | null;
  fetchPriority?: 'high' | 'low' | 'auto';
  sizes?: string;
  quality?: number;
  widths?: number[];
  simple?: boolean;
}

export function ResponsiveImageMarkup({
  src,
  alt = '',
  width = null,
  height = null,
  className,
  intrinsic = false,
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
  simple = false,
}: ResponsiveImageMarkupProps) {
  const actualLowResUrl =
    typeof src === 'object' && src !== null && 'lowResUrl' in src
      ? src.lowResUrl
      : lowResUrl;
  const imageData = simple
    ? {
        src: typeof src === 'string' ? src : src.optimizedUrl || src.url || '',
        srcSet: '',
        webpSrcSet: '',
        sizes: sizes || '100vw',
        width,
        height,
        alt,
      }
    : generateResponsiveImage(src, {
        width,
        height,
        alt: alt ?? undefined,
        quality: quality ?? 80,
        fit: intrinsic
          ? 'scale-down'
          : width && height
            ? 'cover'
            : 'scale-down',
        gravity,
        sizes,
        widths,
      });

  if (!imageData) {
    return null;
  }

  const aspectRatio =
    !fill && !intrinsic && width && height && width > 0 && height > 0
      ? height / width
      : undefined;
  const blurPlaceholder = getBlurPlaceholder(src, actualLowResUrl);
  const containerStyles = intrinsic
    ? undefined
    : fill
      ? undefined
      : aspectRatio
        ? { aspectRatio: width && height ? `${width} / ${height}` : undefined }
        : undefined;
  const imageClasses = intrinsic
    ? 'block max-w-full h-auto rounded-sm'
    : fill || aspectRatio
      ? 'absolute inset-0 w-full h-full'
      : 'w-full h-auto';
  const containerClasses = intrinsic
    ? 'flex justify-center'
    : fill
      ? 'overflow-hidden'
      : aspectRatio
        ? 'relative overflow-hidden'
        : '';
  const shouldScalePlaceholder = objectFit === 'cover' || objectFit === 'fill';

  if (intrinsic) {
    return (
      <div className={cn(containerClasses, className)} style={containerStyles}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageData.src}
          srcSet={imageData.srcSet || undefined}
          sizes={imageData.sizes}
          alt={alt || ''}
          width={width || undefined}
          height={height || undefined}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          fetchPriority={fetchPriority}
          className={imageClasses}
          style={{
            objectFit,
            objectPosition,
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn(containerClasses, className)} style={containerStyles}>
      {(fill || aspectRatio) && blurPlaceholder ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={blurPlaceholder}
          alt=""
          aria-hidden="true"
          className={cn(imageClasses, 'opacity-100')}
          style={{
            objectFit,
            objectPosition,
            filter: 'blur(20px)',
            transform: shouldScalePlaceholder ? 'scale(1.1)' : undefined,
          }}
        />
      ) : null}

      <picture>
        {imageData.webpSrcSet ? (
          <source type="image/webp" srcSet={imageData.webpSrcSet} sizes={imageData.sizes} />
        ) : null}
        <img
          src={imageData.src}
          srcSet={imageData.srcSet || undefined}
          sizes={imageData.sizes}
          alt={alt || ''}
          width={width || undefined}
          height={height || undefined}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          fetchPriority={fetchPriority}
          className={imageClasses}
          style={{
            objectFit,
            objectPosition,
          }}
        />
      </picture>
    </div>
  );
}
