/**
 * Cloudflare R2 Image Transformation Utilities
 *
 * Provides helper functions to transform R2 image URLs with various parameters
 * for responsive images, format conversion, and optimization.
 */

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'jpg' | 'png';
  quality?: number;
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  gravity?: 'auto' | 'left' | 'right' | 'top' | 'bottom' | 'center';
  background?: string; // Hex color (e.g., 'ffffff' for white)
  blur?: number; // Blur radius (1-250)
  sharpen?: number; // Sharpen amount (0-10)
}

/**
 * Transform an R2 image URL with Cloudflare image transformation parameters
 */
export function transformR2Image(
  url: string | undefined | null,
  options: ImageTransformOptions = {}
): string {
  if (!url) {
    return '';
  }

  const params = new URLSearchParams();

  if (options.width) params.set('width', options.width.toString());
  if (options.height) params.set('height', options.height.toString());
  if (options.format) params.set('format', options.format);
  if (options.quality) params.set('quality', options.quality.toString());
  if (options.fit) params.set('fit', options.fit);
  if (options.gravity) params.set('gravity', options.gravity);
  if (options.background) params.set('background', options.background);
  if (options.blur) params.set('blur', options.blur.toString());
  if (options.sharpen) params.set('sharpen', options.sharpen.toString());

  const paramString = params.toString();
  return paramString ? `${url}?${paramString}` : url;
}

/**
 * Generate a srcSet string for responsive images
 */
export function generateSrcSet(
  url: string | undefined | null,
  widths: number[],
  options: Omit<ImageTransformOptions, 'width'> = {}
): string {
  if (!url) {
    return '';
  }

  return widths
    .map((width) => {
      const transformedUrl = transformR2Image(url, { ...options, width });
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
  url: string | undefined | null,
  options: {
    widths?: number[];
    sizes?: string;
    alt?: string | null;
    width?: number | null;
    height?: number | null;
    quality?: number;
    includeAvif?: boolean;
  } = {}
): ResponsiveImageData | null {
  if (!url) {
    return null;
  }

  const {
    widths = [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    sizes = '100vw',
    alt = null,
    width = null,
    height = null,
    quality = 75,
    includeAvif = false,
  } = options;

  return {
    src: transformR2Image(url, { quality, format: 'jpeg' }),
    srcSet: generateSrcSet(url, widths, { quality, format: 'jpeg' }),
    webpSrcSet: generateSrcSet(url, widths, { quality, format: 'webp' }),
    avifSrcSet: includeAvif
      ? generateSrcSet(url, widths, { quality, format: 'avif' })
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
  url: string | undefined | null,
  size = 100,
  quality = 75
): string {
  return transformR2Image(url, {
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
  url: string | undefined | null,
  width = 2000,
  height = 1000,
  quality = 75
): string {
  return transformR2Image(url, {
    width,
    height,
    fit: 'cover',
    quality,
    format: 'jpeg',
  });
}

/**
 * Generate a low-quality blurred placeholder for progressive image loading
 * This replicates DatoCMS LQIP (Low Quality Image Placeholder) behavior
 *
 * Returns a Cloudflare R2 URL with blur and low quality for use as Next.js Image placeholder
 */
export function getBlurPlaceholder(
  url: string | undefined | null,
  width = 20,
  quality = 20
): string {
  if (!url) {
    return '';
  }

  return transformR2Image(url, {
    width,
    quality,
    blur: 10, // Cloudflare blur radius (1-250)
    format: 'jpeg',
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
