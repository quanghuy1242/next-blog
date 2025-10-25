/**
 * Image Utilities - Native Storage Variants
 *
 * Provides helper functions to work with pre-generated image variants from storage.
 * Instead of on-demand transformation, uses native storage variants with naming pattern:
 *
 * Pattern: {basename}-{width}x{height}.{format}
 * Example: image-640x320.webp, image-1200x600.webp
 *
 * Available widths: 480, 640, 750, 828, 1080, 1200, 1920
 * Formats: webp (with optimized JPG fallback)
 */

import type { Media } from 'types/cms';

/**
 * Get the preferred URL from a Media object.
 * Prioritizes optimizedUrl (pre-computed backend URL) over url (on-demand transformation).
 *
 * @param media - Media object from CMS
 * @returns The optimized URL if available, otherwise falls back to url
 */
export function getMediaUrl(media: Media | null | undefined): string {
  if (!media) return '';
  return media.optimizedUrl || media.url || '';
}

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  format?: 'webp' | 'jpeg' | 'jpg' | 'png' | 'auto';
  quality?: number;
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  gravity?: 'auto' | 'left' | 'right' | 'top' | 'bottom' | 'center';
  background?: string; // Hex color (e.g., 'ffffff' for white)
  blur?: number; // Blur radius (1-250)
  sharpen?: number; // Sharpen amount (0-10)
  rotate?: 90 | 180 | 270;
  flip?: 'h' | 'v' | 'hv';
}

/**
 * Transform an image URL to use native storage variants
 * Replaces the suffix (e.g., '-optimized.webp') with the variant format (e.g., '-640x320.webp')
 *
 * @example
 * transformImage('https://example.com/image-optimized.webp', { width: 640, format: 'webp' })
 * // Returns: 'https://example.com/image-640x320.webp'
 */
export function transformImage(
  url: string | undefined | null,
  options: ImageTransformOptions = {}
): string {
  if (!url) {
    return '';
  }

  // If no width is specified or not using webp, return original URL
  const format = options.format || 'webp';
  if (!options.width || format !== 'webp') {
    return url;
  }

  try {
    // Calculate height maintaining aspect ratio if needed
    const width = options.width;
    let height = options.height;

    // For responsive images, maintain 2:1 aspect ratio if height not specified
    if (!height && (options.fit === 'cover' || options.fit === 'crop')) {
      height = Math.round(width / 2);
    }

    // Replace the suffix with the variant
    // Pattern: remove '-optimized.webp' or similar and replace with '-{width}x{height}.{format}'
    const variantSuffix = height
      ? `-${width}x${height}.${format}`
      : `-${width}.${format}`;

    // Remove existing suffix (matches patterns like '-optimized.webp', '-1920x1080.webp', etc.)
    const urlWithoutSuffix = url.replace(
      /(-optimized|-\d+x?\d*)?\.(webp|avif|jpg|jpeg|png)$/i,
      ''
    );

    return `${urlWithoutSuffix}${variantSuffix}`;
  } catch {
    // If transformation fails, return original URL
    return url;
  }
}

/**
 * Generate a srcSet string for responsive images using native storage variants
 * Maintains aspect ratio when both width and height are provided in options
 */
export function generateSrcSet(
  url: string | undefined | null,
  widths: number[],
  options: Omit<ImageTransformOptions, 'width'> = {},
  aspectRatio?: number // height / width ratio
): string {
  if (!url) {
    return '';
  }

  return widths
    .map((width) => {
      const transformOptions: ImageTransformOptions = { ...options, width };

      // For responsive images, maintain aspect ratio (typically 2:1)
      if (aspectRatio) {
        transformOptions.height = Math.round(width * aspectRatio);
      }

      const transformedUrl = transformImage(url, transformOptions);
      return `${transformedUrl} ${width}w`;
    })
    .join(', ');
}

/**
 * Generate responsive image object with multiple formats and sizes
 */
export interface ResponsiveImageData {
  src: string; // Fallback JPG (optimized URL)
  srcSet: string; // WebP srcSet
  webpSrcSet: string; // WebP srcSet
  sizes: string;
  width?: number | null;
  height?: number | null;
  alt?: string | null;
}

export function generateResponsiveImage(
  urlOrMedia: string | Media | undefined | null,
  options: {
    widths?: number[];
    sizes?: string;
    alt?: string | null;
    width?: number | null;
    height?: number | null;
    quality?: number;
    fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
    gravity?: 'auto' | 'left' | 'right' | 'top' | 'bottom' | 'center';
  } = {}
): ResponsiveImageData | null {
  // Extract the URL to use for transformations (prefer optimizedUrl)
  const url =
    typeof urlOrMedia === 'string' ? urlOrMedia : getMediaUrl(urlOrMedia);

  if (!url) {
    return null;
  }

  // Native storage supports variants up to specific widths
  // Common variants: 480, 640, 750, 828, 1080, 1200, 1920
  const AVAILABLE_WIDTHS = [480, 640, 750, 828, 1080, 1200, 1920];

  const {
    widths = AVAILABLE_WIDTHS,
    sizes = '100vw',
    alt = null,
    width = null,
    height = null,
    quality = 80, // Not used with native variants, kept for API compatibility
  } = options;

  // Filter to only use available variant widths
  const finalWidths = widths.filter((w) => AVAILABLE_WIDTHS.includes(w));

  // Base transformation options for all formats
  const baseOptions: ImageTransformOptions = {
    quality,
    fit: 'cover', // Native variants use cover by default (2:1 aspect ratio)
  };

  // Calculate aspect ratio for srcSet generation (typically 2:1 for cover images)
  const aspectRatio = width && height && width > 0 ? height / width : 0.5; // Default to 2:1

  return {
    src: url, // Use optimized JPG as fallback
    srcSet: generateSrcSet(
      url,
      finalWidths,
      { ...baseOptions, format: 'webp' },
      aspectRatio
    ),
    webpSrcSet: generateSrcSet(
      url,
      finalWidths,
      { ...baseOptions, format: 'webp' },
      aspectRatio
    ),
    sizes,
    width,
    height,
    alt,
  };
}

/**
 * Get optimized thumbnail URL
 * Uses native storage variant
 */
export function getThumbnailUrl(
  urlOrMedia: string | Media | undefined | null
): string {
  // Extract the URL to use (prefer optimizedUrl)
  const url =
    typeof urlOrMedia === 'string' ? urlOrMedia : getMediaUrl(urlOrMedia);

  // Use smallest available variant for thumbnails
  return transformImage(url, {
    width: 480,
    format: 'webp',
    fit: 'cover',
  });
}

/**
 * Get cover image URL
 * Returns the optimizedUrl directly (no transformation needed)
 */
export function getCoverImageUrl(
  urlOrMedia: string | Media | undefined | null
): string {
  // Extract the URL to use (prefer optimizedUrl)
  const url =
    typeof urlOrMedia === 'string' ? urlOrMedia : getMediaUrl(urlOrMedia);

  // Return optimizedUrl directly - CSS handles sizing
  return url || '';
}

/**
 * Generate a low-quality blurred placeholder for progressive image loading
 *
 * If lowResUrl is provided (base64 data URL from backend), use it directly.
 * Otherwise, uses the smallest available variant (480px).
 *
 * @param urlOrMedia - Source image URL or Media object
 * @param lowResUrl - Optional pre-generated base64 data URL from backend
 */
export function getBlurPlaceholder(
  urlOrMedia: string | Media | undefined | null,
  lowResUrl?: string | null
): string {
  // If we have a pre-generated low-res data URL from backend, use it directly
  if (lowResUrl) {
    return lowResUrl;
  }

  // Extract the URL to use (prefer optimizedUrl)
  const url =
    typeof urlOrMedia === 'string' ? urlOrMedia : getMediaUrl(urlOrMedia);

  if (!url) {
    return '';
  }

  // Use smallest available variant for blur placeholder
  return transformImage(url, {
    width: 480,
    format: 'webp',
    fit: 'cover',
  });
}

/**
 * Get optimized image URLs for Next.js Image with blur placeholder
 * This provides the full-quality image URL and a blurred placeholder URL
 */
export interface ImageWithPlaceholder {
  src: string;
  blurDataURL: string;
  width?: number | null;
  height?: number | null;
  alt?: string | null;
}

export function getImageWithPlaceholder(
  url: string | undefined | null,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    alt?: string | null;
  } = {}
): ImageWithPlaceholder | null {
  if (!url) {
    return null;
  }

  const { width = 2000, height = 1000, alt = null } = options;

  return {
    src: getCoverImageUrl(url),
    blurDataURL: getBlurPlaceholder(url),
    width,
    height,
    alt,
  };
}

/**
 * Default placeholder image for missing avatars
 */
export const DEFAULT_AVATAR_PLACEHOLDER =
  'https://ui-avatars.com/api/?name=User&size=200&background=random';
