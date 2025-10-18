import cn from 'classnames';
import { CoverImage } from 'components/shared/cover-image';
import Link from 'next/link';
import { useState } from 'react';
import type { Category as CategoryData } from 'types/datocms';

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
  const [show, setShow] = useState(false);
  const descriptionText = description ?? '';

  return (
    <Link
      href={`/categories/${slug}`}
      className={cn(className, 'block relative mb-2')}
      onMouseOver={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <CoverImage responsiveImage={image.responsiveImage} />
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
            show ? 'transform translate-y-1' : 'transform translate-y-3'
          )}
        >
          {name}
        </div>
        <div
          className={cn(
            'text-white md:text-sm text-sm',
            'transition-opacity duration-300 ease-in-out',
            show ? 'opacity-100' : 'opacity-0'
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

export function Categories({ categories = [] }: CategoriesProps) {
  return (
    <div>
      {categories
        .filter((category): category is CategoryData & { image: NonNullable<CategoryData['image']> } => !!category.image)
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
