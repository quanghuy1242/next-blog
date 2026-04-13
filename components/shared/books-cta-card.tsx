import React from 'react';
import cn from 'classnames';
import type { Media } from 'types/cms';
import { CategoryCard } from './categories';

export const BOOKS_CTA_IMAGE_URL =
  'https://payload-cdn.quanghuy.dev/rey-seven-_nm_mZ4Cs2I-unsplash.jpg?2026-04-13T06%3A28%3A42.300Z';

export const BOOKS_CTA_MEDIA: Media = {
  alt: 'Books banner',
  optimizedUrl: BOOKS_CTA_IMAGE_URL,
  url: BOOKS_CTA_IMAGE_URL,
};

interface BooksCtaCardProps {
  className?: string;
  subtext?: string;
}

export function BooksCtaCard({
  className,
  subtext = 'Open the bookshelf',
}: BooksCtaCardProps) {
  return (
    <CategoryCard
      name="Books"
      description={subtext}
      image={BOOKS_CTA_MEDIA}
      href="/books"
      className={cn('mb-4', className)}
    />
  );
}
