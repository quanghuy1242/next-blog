/* eslint-disable jsx-a11y/alt-text */
import { Image } from 'react-datocms';
import cn from 'classnames';
import Link from 'next/link';

export function CoverImage({ title, responsiveImage, slug, className }) {
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
        <Link as={`/posts/${slug}`} href="/posts/[slug]" prefetch={false}>
          <a aria-label={title}>{image}</a>
        </Link>
      ) : (
        image
      )}
    </div>
  );
}
