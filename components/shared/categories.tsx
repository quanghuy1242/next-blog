import React from 'react';
import cn from 'classnames';
import { CoverImage } from 'components/shared/cover-image';
import Link from 'next/link';
import { useState } from 'react';
import type { LinkProps } from 'next/link';
import type { Category as CategoryData } from 'types/cms';

export interface CategoryCardProps {
  name: string;
  image?: NonNullable<CategoryData['image']> | null;
  description?: string | null;
  href: LinkProps['href'];
  className?: string;
  alwaysShowDescription?: boolean;
  simpleImage?: boolean;
}

export function CategoryCard({
  name,
  image = null,
  description = '',
  href,
  className,
  alwaysShowDescription = false,
  simpleImage = false,
}: CategoryCardProps) {
  const [show, setShow] = useState(false);
  const descriptionText = description ?? '';
  const shouldShowDescription = alwaysShowDescription || show;
  const titleTransformClass = shouldShowDescription
    ? 'transform translate-y-1'
    : 'transform translate-y-3';
  const descriptionOpacityClass = shouldShowDescription
    ? 'opacity-100'
    : 'opacity-0';

  return (
    <Link
      href={href}
      className={cn(className, 'block relative mb-2')}
      onMouseOver={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {image ? (
        <CoverImage media={image} simple={simpleImage} />
      ) : (
        <div className="h-40 w-full rounded-sm bg-gradient-to-br from-blue to-darkBlue shadow-small" />
      )}
      <div
        className={cn(
          'absolute top-0 left-0 bottom-0 right-0',
          'flex flex-col justify-center items-center'
        )}
      >
        <div
          className={cn(
            'text-white md:text-2xl text-xl',
            'transition-transform duration-300 ease-in-out',
            titleTransformClass
          )}
        >
          {name}
        </div>
        <div
          className={cn(
            'text-white md:text-sm text-sm',
            'transition-opacity duration-300 ease-in-out',
            descriptionOpacityClass
          )}
        >
          {descriptionText.slice(0, 35)}
        </div>
      </div>
    </Link>
  );
}

interface CategoriesProps {
  categories?: CategoryData[];
}

interface CategoryProps {
  name: string;
  image: NonNullable<CategoryData['image']>;
  description?: string | null;
  slug: string;
  className?: string;
}

export function Category({
  name,
  image,
  description = '',
  slug,
  className,
}: CategoryProps) {
  return (
    <CategoryCard
      name={name}
      image={image}
      description={description}
      href={{
        pathname: '/',
        query: {
          category: slug,
        },
      }}
      className={className}
    />
  );
}

export function Categories({ categories = [] }: CategoriesProps) {
  return (
    <div>
      {categories
        .filter(
          (
            category
          ): category is CategoryData & {
            image: NonNullable<CategoryData['image']>;
          } => !!category.image
        )
        .map((category) => (
          <Category
            name={category.name}
            description={category.description}
            image={category.image}
            slug={category.slug}
            key={category.slug}
          />
        ))}
    </div>
  );
}
