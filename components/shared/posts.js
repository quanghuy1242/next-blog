import cn from 'classnames';
import { CoverImage } from 'components/shared/cover-image';
import { Date } from 'components/shared/date';
import { Tag, Tags } from 'components/shared/tags';
import Link from 'next/link';

const PostTitle = ({ slug, title }) => (
  <h3 className="text-2xl leading-snug">
    <Link as={`/posts/${slug}`} href="/posts/[slug]" prefetch={false}>
      <a className="hover:underline">{title}</a>
    </Link>
  </h3>
);

export function Post({
  title,
  coverImage,
  date,
  excerpt,
  slug,
  category = '',
  tags = [],
}) {
  return (
    <div className="flex flex-col gap-1">
      <CoverImage
        slug={slug}
        title={title}
        responsiveImage={coverImage.responsiveImage}
        className="mb-3"
      />
      <PostTitle slug={slug} title={title} />
      <Date dateString={date} className="text-sm text-gray-700" />
      <div className="flex flex-row gap-1">
        <Tag
          text={category.name}
          link={{ as: `/posts/${slug}`, href: '/posts/[slug]' }}
          primary={true}
        />
        <Tags
          items={tags.map((tag) => ({
            name: tag,
            link: { as: '/', href: '/' },
          }))}
        />
      </div>
      <p className="text-base leading-relaxed">{excerpt}</p>
    </div>
  );
}

export function Posts({ posts, hasMoreCol = true }) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-y-10',
        'lg:gap-x-10',
        'md:gap-x-10 md:gap-y-10',
        { 'md:grid-cols-2': hasMoreCol, 'md:grid-cols-1': !hasMoreCol }
      )}
    >
      {posts.map((post) => (
        <Post
          key={post.slug}
          title={post.title}
          coverImage={post.coverImage}
          date={post.date}
          slug={post.slug}
          excerpt={post.excerpt}
          category={post.category}
          tags={post.tags.split(', ').filter(Boolean)}
        />
      ))}
    </div>
  );
}
