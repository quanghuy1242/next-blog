import cn from 'classnames';
import { CoverImage } from 'components/shared/cover-image';
import { Date } from 'components/shared/date';
import { Tag, Tags } from 'components/shared/tags';
import Link from 'next/link';
import type { LinkProps } from 'next/link';
import type { Post as PostType } from 'types/datocms';

interface PostTitleProps {
  slug: string;
  title: string;
}

const PostTitle = ({ slug, title }: PostTitleProps) => (
  <h3 className="text-2xl leading-snug">
    <Link href={`/posts/${slug}`} className="hover:underline">
      {title}
    </Link>
  </h3>
);

export interface PostProps {
  title: string;
  coverImage: PostType['coverImage'];
  date: string;
  excerpt?: string | null;
  slug: string;
  category?: PostType['category'];
  tags?: string[];
}

export function Post({
  title,
  coverImage,
  date,
  excerpt,
  slug,
  category,
  tags = [],
}: PostProps) {
  const categoryName =
    typeof category === 'string' ? category : category?.name ?? '';
  const categorySlug =
    typeof category === 'object' && category ? category.slug : null;

  const categoryHref: LinkProps['href'] | undefined = categorySlug
    ? { pathname: '/', query: { category: categorySlug } }
    : undefined;

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
        {categoryName && (
          <Tag
            text={categoryName}
            href={categoryHref}
            primary={true}
          />
        )}
        <Tags
          items={tags.map((tag) => ({
            name: tag,
            href: { pathname: '/', query: { tag } },
          }))}
        />
      </div>
      <p className="text-base leading-relaxed">{excerpt ?? ''}</p>
    </div>
  );
}

interface PostsProps {
  posts: PostType[];
  hasMoreCol?: boolean;
}

export function Posts({ posts, hasMoreCol = true }: PostsProps) {
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
          tags={normalizeTags(post.tags)}
        />
      ))}
    </div>
  );
}

function normalizeTags(tags: PostType['tags']): string[] {
  if (typeof tags === 'string') {
    return tags.split(', ').filter(Boolean);
  }

  if (Array.isArray(tags)) {
    return tags.filter((tag): tag is string => Boolean(tag));
  }

  return [];
}
