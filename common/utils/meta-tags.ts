/**
 * Meta Tags Generation Utilities
 *
 * Replacement for react-datocms renderMetaTags function.
 * Generates HTML meta tags for SEO from PayloadCMS meta objects.
 */

import type { PostMeta, HomepageMeta, MetaTag } from '../../types/cms';

export interface MetaTagsOptions {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  url?: string | null;
  type?: 'website' | 'article';
  siteName?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  author?: string | null;
  publishedTime?: string | null;
  modifiedTime?: string | null;
}

/**
 * Generate meta tags array from options
 */
export function generateMetaTags(options: MetaTagsOptions): MetaTag[] {
  const {
    title,
    description,
    image,
    url,
    type = 'website',
    siteName = 'Next Blog',
    twitterCard = 'summary_large_image',
    author,
    publishedTime,
    modifiedTime,
  } = options;

  const tags: MetaTag[] = [];

  // Basic meta tags
  if (title) {
    tags.push({ tag: 'title', content: title });
    tags.push({
      tag: 'meta',
      attributes: { name: 'title', content: title },
    });
  }

  if (description) {
    tags.push({
      tag: 'meta',
      attributes: { name: 'description', content: description },
    });
  }

  // Open Graph meta tags
  if (title) {
    tags.push({
      tag: 'meta',
      attributes: { property: 'og:title', content: title },
    });
  }

  if (description) {
    tags.push({
      tag: 'meta',
      attributes: { property: 'og:description', content: description },
    });
  }

  if (image) {
    tags.push({
      tag: 'meta',
      attributes: { property: 'og:image', content: image },
    });
  }

  if (url) {
    tags.push({
      tag: 'meta',
      attributes: { property: 'og:url', content: url },
    });
  }

  tags.push({
    tag: 'meta',
    attributes: { property: 'og:type', content: type },
  });

  if (siteName) {
    tags.push({
      tag: 'meta',
      attributes: { property: 'og:site_name', content: siteName },
    });
  }

  // Article-specific meta tags
  if (type === 'article') {
    if (author) {
      tags.push({
        tag: 'meta',
        attributes: { property: 'article:author', content: author },
      });
    }

    if (publishedTime) {
      tags.push({
        tag: 'meta',
        attributes: {
          property: 'article:published_time',
          content: publishedTime,
        },
      });
    }

    if (modifiedTime) {
      tags.push({
        tag: 'meta',
        attributes: {
          property: 'article:modified_time',
          content: modifiedTime,
        },
      });
    }
  }

  // Twitter Card meta tags
  tags.push({
    tag: 'meta',
    attributes: { name: 'twitter:card', content: twitterCard },
  });

  if (title) {
    tags.push({
      tag: 'meta',
      attributes: { name: 'twitter:title', content: title },
    });
  }

  if (description) {
    tags.push({
      tag: 'meta',
      attributes: { name: 'twitter:description', content: description },
    });
  }

  if (image) {
    tags.push({
      tag: 'meta',
      attributes: { name: 'twitter:image', content: image },
    });
  }

  return tags;
}

/**
 * Generate meta tags from PostMeta object
 */
export function generatePostMetaTags(
  meta: PostMeta | null | undefined,
  fallback?: {
    title?: string;
    description?: string;
    image?: string;
  }
): MetaTag[] {
  return generateMetaTags({
    title: meta?.title || fallback?.title || null,
    description: meta?.description || fallback?.description || null,
    image: meta?.image?.url || fallback?.image || null,
    type: 'article',
  });
}

/**
 * Generate meta tags from HomepageMeta object
 */
export function generateHomepageMetaTags(
  meta: HomepageMeta | null | undefined,
  fallback?: {
    title?: string;
    description?: string;
    image?: string;
  }
): MetaTag[] {
  return generateMetaTags({
    title: meta?.title || fallback?.title || null,
    description: meta?.description || fallback?.description || null,
    image: meta?.image?.url || fallback?.image || null,
    type: 'website',
  });
}
