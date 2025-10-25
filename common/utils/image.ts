/**
 * Cloudflare Image Transformation Utilities
 *
 * Provides helper functions to transform image URLs using Cloudflare's
 * /cdn-cgi/image/ transformation endpoint.
 *
 * URL format: https://<ZONE>/cdn-cgi/image/<OPTIONS>/<SOURCE-IMAGE>
 * @see https://developers.cloudflare.com/images/transform-images/transform-via-url
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
  format?: 'webp' | 'avif' | 'jpeg' | 'jpg' | 'png' | 'auto';
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
 * Transform an image URL using Cloudflare's /cdn-cgi/image/ endpoint
 *
 * @example
 * transformImage('https://example.com/image.jpg', { width: 800, quality: 75 })
 * // Returns: 'https://example.com/cdn-cgi/image/width=800,quality=75/image.jpg'
 */
export function transformImage(
  url: string | undefined | null,
  options: ImageTransformOptions = {}
): string {
  if (!url) {
    return '';
  }

  const params: string[] = [];

  if (options.width) params.push(`width=${options.width}`);
  if (options.height) params.push(`height=${options.height}`);
  if (options.format) params.push(`format=${options.format}`);
  if (options.quality) params.push(`quality=${options.quality}`);
  if (options.fit) params.push(`fit=${options.fit}`);
  if (options.gravity) params.push(`gravity=${options.gravity}`);
  if (options.background) params.push(`background=${options.background}`);
  if (options.blur) params.push(`blur=${options.blur}`);
  if (options.sharpen) params.push(`sharpen=${options.sharpen}`);
  if (options.rotate) params.push(`rotate=${options.rotate}`);
  if (options.flip) params.push(`flip=${options.flip}`);

  if (params.length === 0) {
    return url;
  }

  // Parse the URL to extract the zone and path
  try {
    const urlObj = new URL(url);
    const optionsStr = params.join(',');

    // Construct: https://<ZONE>/cdn-cgi/image/<OPTIONS>/<SOURCE-IMAGE>
    // The source image path should be the full path after the domain
    const sourcePath = urlObj.pathname + urlObj.search + urlObj.hash;

    const transformedUrl = `${urlObj.origin}/cdn-cgi/image/${optionsStr}${sourcePath}`;

    return transformedUrl;
  } catch {
    // If URL parsing fails, return original URL
    return url;
  }
}

/**
 * Generate a srcSet string for responsive images
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

      // Only add height for cover/crop/pad modes where exact dimensions matter
      // For scale-down/contain, let R2 maintain original aspect ratio
      const needsExactDimensions =
        options.fit === 'cover' ||
        options.fit === 'crop' ||
        options.fit === 'pad';

      if (aspectRatio && needsExactDimensions) {
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
  src: string;
  srcSet: string;
  webpSrcSet: string;
  avifSrcSet?: string;
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
    includeAvif?: boolean;
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

  // Check if we're using an optimized URL (pre-computed backend images)
  // Optimized images are always 1920px wide, so we avoid upscaling beyond that
  const isOptimizedUrl =
    typeof urlOrMedia === 'object' && urlOrMedia !== null
      ? !!urlOrMedia.optimizedUrl
      : false;

  // Maximum width to prevent upscaling optimized images (1920px)
  const OPTIMIZED_MAX_WIDTH = 1920;

  const {
    widths = [640, 750, 828, 1080, 1200, 1920, 2100, 3840],
    sizes = '100vw',
    alt = null,
    width = null,
    height = null,
    quality = 80, // Higher quality for better visual experience
    includeAvif = true,
    fit = 'scale-down', // Default: resize without cropping, maintaining aspect ratio
    gravity,
  } = options;

  // Optimization: If using optimized URL (1920px), filter out larger sizes
  // This prevents Cloudflare from trying to upscale beyond the source resolution
  // Reduces: 1) transformation costs, 2) bandwidth waste, 3) quality loss from upscaling
  const finalWidths = isOptimizedUrl
    ? widths.filter((w) => w <= OPTIMIZED_MAX_WIDTH)
    : widths;

  // Base transformation options for all formats
  const baseOptions: ImageTransformOptions = {
    quality,
    fit, // Always include fit mode to control how images are resized
  };

  // For cover/crop modes with specific dimensions, set both width and height
  // For scale-down/contain modes, let R2 maintain aspect ratio naturally
  const shouldSetDimensions =
    fit === 'cover' || fit === 'crop' || fit === 'pad';

  if (width && height && shouldSetDimensions) {
    baseOptions.width = width;
    baseOptions.height = height;
    if (gravity) {
      baseOptions.gravity = gravity; // Add gravity for crop focal point
    }
  } else if (width && !height) {
    // If only width is provided, set it for any fit mode
    baseOptions.width = width;
  }

  // Calculate aspect ratio for srcSet generation
  const aspectRatio = width && height && width > 0 ? height / width : undefined;

  return {
    src: transformImage(url, { ...baseOptions, format: 'webp' }), // WebP as default, lighter than JPEG
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
    avifSrcSet: includeAvif
      ? generateSrcSet(
          url,
          finalWidths,
          { ...baseOptions, format: 'avif' },
          aspectRatio
        ) // AVIF is even smaller than WebP
      : undefined,
    sizes,
    width,
    height,
    alt,
  };
}

/**
 * Get optimized thumbnail URL
 */
export function getThumbnailUrl(
  urlOrMedia: string | Media | undefined | null,
  size = 100,
  quality = 80
): string {
  // Extract the URL to use for transformations (prefer optimizedUrl)
  const url =
    typeof urlOrMedia === 'string' ? urlOrMedia : getMediaUrl(urlOrMedia);

  return transformImage(url, {
    width: size,
    height: size,
    fit: 'cover',
    quality,
    format: 'webp',
  });
}

/**
 * Get cover image URL with specific dimensions
 */
export function getCoverImageUrl(
  urlOrMedia: string | Media | undefined | null,
  width = 2000,
  height = 1000,
  quality = 80
): string {
  // Extract the URL to use for transformations (prefer optimizedUrl)
  const url =
    typeof urlOrMedia === 'string' ? urlOrMedia : getMediaUrl(urlOrMedia);

  return transformImage(url, {
    width,
    height,
    fit: 'cover',
    quality,
    format: 'webp', // WebP is 20-30% smaller than JPEG at same quality
  });
}

/**
 * Generate a low-quality blurred placeholder for progressive image loading
 * This replicates DatoCMS LQIP (Low Quality Image Placeholder) behavior
 *
 * If lowResUrl is provided (base64 data URL from backend), use it directly.
 * Otherwise, returns a Cloudflare-transformed URL with blur and low quality.
 *
 * @param urlOrMedia - Source image URL or Media object
 * @param width - Target width for placeholder (default: 20px)
 * @param height - Optional height to maintain aspect ratio
 * @param quality - Quality setting (default: 20)
 * @param lowResUrl - Optional pre-generated base64 data URL from backend
 */
export function getBlurPlaceholder(
  urlOrMedia: string | Media | undefined | null,
  width = 20,
  height?: number,
  quality = 20,
  lowResUrl?: string | null
): string {
  // If we have a pre-generated low-res data URL from backend, use it directly
  if (lowResUrl) {
    return lowResUrl;
  }

  // Extract the URL to use for transformations (prefer optimizedUrl)
  const url =
    typeof urlOrMedia === 'string' ? urlOrMedia : getMediaUrl(urlOrMedia);

  if (!url) {
    return '';
  }

  const options: ImageTransformOptions = {
    width,
    quality,
    blur: 10,
    format: 'jpeg',
  };

  // If height is provided, maintain aspect ratio
  if (height) {
    options.height = height;
    options.fit = 'scale-down'; // Maintain aspect ratio, don't crop
  }

  return transformImage(url, options);
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

  const { width = 2000, height = 1000, quality = 75, alt = null } = options;

  return {
    src: getCoverImageUrl(url, width, height, quality),
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
