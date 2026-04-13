import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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

  const updateControls = useCallback(() => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const maxScrollLeft = Math.max(scrollWidth - clientWidth, 0);

    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < maxScrollLeft - 1);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    updateControls();

    container.addEventListener('scroll', updateControls, { passive: true });
    window.addEventListener('resize', updateControls);

    return () => {
      container.removeEventListener('scroll', updateControls);
      window.removeEventListener('resize', updateControls);
    };
  }, [updateControls]);

  const scrollRail = useCallback((direction: 'left' | 'right') => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    const amount = Math.max(container.clientWidth * 0.8, 220);

    container.scrollBy({
      left: direction === 'right' ? amount : -amount,
      behavior: 'smooth',
    });
  }, []);

  if (!items.length) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Scroll categories left"
        onClick={() => scrollRail('left')}
        disabled={!canScrollLeft}
        className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-blue px-2 py-1 text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Prev
      </button>
      <button
        type="button"
        aria-label="Scroll categories right"
        onClick={() => scrollRail('right')}
        disabled={!canScrollRight}
        className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-blue px-2 py-1 text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>

      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-9 pb-2"
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
          />
        ))}
      </div>
    </div>
  );
}
