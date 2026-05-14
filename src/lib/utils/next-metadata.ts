import type { Metadata } from 'next';

interface MetadataOptions {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  type?: 'website' | 'article';
}

export function buildMetadata({
  title,
  description,
  image,
  type = 'website',
}: MetadataOptions): Metadata {
  const resolvedTitle = title || undefined;
  const resolvedDescription = description || undefined;

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    openGraph: {
      type,
      title: resolvedTitle,
      description: resolvedDescription,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: resolvedTitle,
      description: resolvedDescription,
      images: image ? [image] : undefined,
    },
  };
}
