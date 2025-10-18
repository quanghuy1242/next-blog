/* eslint-disable jsx-a11y/alt-text */
import cn from 'classnames';
import Link from 'next/link';
import { Image } from 'react-datocms';
import type { ResponsiveImageType } from 'react-datocms';

interface CoverImageProps {
  title?: string | null;
  responsiveImage: ResponsiveImageType;
  slug?: string;
  className?: string;
}

export function CoverImage({
  title,
  responsiveImage,
  slug,
  className,
}: CoverImageProps) {
  const image = (
    <Image
      data={{
        ...responsiveImage,
        alt: `Cover Image for ${title}`,
      }}
      className={cn('shadow-small', {
        'hover:shadow-medium transition-shadow duration-200': slug,
      })}
    />
  );
  return (
    <div className={cn('sm:mx-0', className)}>
      {slug ? (
        <Link
          href={`/posts/${slug}`}
          prefetch={false}
          aria-label={title ?? 'Post cover'}
          className="block"
        >
          {image}
        </Link>
      ) : (
        image
      )}
    </div>
  );
}
