import React from 'react';
import cn from 'classnames';
import type { Media } from 'types/cms';
import { CategoryCard } from './categories';

interface BooksCtaCardProps {
  media?: Media | null;
  className?: string;
  subtext?: string;
}

export function BooksCtaCard({
  media = null,
  className,
  subtext = 'Open the bookshelf',
}: BooksCtaCardProps) {
  return (
    <CategoryCard
      name="Books"
      description={subtext}
      image={media}
      href="/books"
      className={cn('mb-4', className)}
      alwaysShowDescription={true}
    />
  );
}
