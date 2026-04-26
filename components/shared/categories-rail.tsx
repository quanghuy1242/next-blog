import React from 'react';
import { useMemo } from 'react';
import type { Category, Media } from 'types/cms';
import { CategoryCard } from './categories';

interface CategoriesRailProps {
  categories?: Category[];
  booksMedia?: Media | null;
  booksSubtext?: string;
}

interface RailItem {
  key: string;
  name: string;
  description: string;
  href: string;
  image?: Media | null;
}

export function CategoriesRail({
  categories = [],
  booksMedia = null,
  booksSubtext = 'Open the bookshelf',
}: CategoriesRailProps) {
  const items = useMemo<RailItem[]>(() => {
    const categoryItems = categories
      .filter(
        (
          category
        ): category is Category & {
          image: NonNullable<Category['image']>;
        } => Boolean(category.image)
      )
      .map((category) => ({
        key: `category-${category.slug}`,
        name: category.name,
        description: category.description || '',
        href: `/?category=${category.slug}`,
        image: category.image,
      }));

    const fallbackImage = categoryItems[0]?.image ?? null;

    return [
      {
        key: 'books',
        name: 'Books',
        description: booksSubtext,
        href: '/books',
        image: booksMedia ?? fallbackImage,
      },
      ...categoryItems,
    ];
  }, [booksMedia, booksSubtext, categories]);

  if (!items.length) {
    return null;
  }

  return (
    <div className="relative">
      <div
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
      >
        {items.map((item) => (
          <CategoryCard
            key={item.key}
            name={item.name}
            description={item.description}
            image={item.image}
            href={item.href}
            className="mb-0 w-56 flex-shrink-0 snap-start sm:w-64"
            alwaysShowDescription={true}
            simpleImage={item.key === 'books'}
            ssrPrefetch={item.key === 'books'}
          />
        ))}
      </div>
    </div>
  );
}
