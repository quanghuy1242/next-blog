import Avatar from 'components/avatar'
import Date from 'components/date'
import CoverImage from './cover-image'
import Link from 'next/link'
import Badge from './badge'

export default function PostPreview({
  title,
  coverImage,
  date,
  excerpt,
  author,
  slug,
  category = '',
  tags = []
}) {
  return (
    <div>
      <div className="mb-3">
        <CoverImage
          slug={slug}
          title={title}
          responsiveImage={coverImage.responsiveImage}
        />
      </div>
      <h3 className="text-2xl leading-snug">
        <Link as={`/posts/${slug}`} href="/posts/[slug]" prefetch={false}>
          <a className="hover:underline">{title}</a>
        </Link>
      </h3>
      <div className="text-sm text-gray-700 mb-1">
        <Date dateString={date} />
      </div>
      <div>
        <Badge
          text={category.name}
          enableBorder={true}
          link={{ as: `/posts/${slug}`, href: '/posts/[slug]' }}
        />
        {tags.map(item => (
          <Badge
            text={item}
            link={{ as: `/posts/${slug}`, href: '/posts/[slug]' }}
            className="ml-2"
            key={item}
          />
      ))}
      </div>
      <p className="text-base leading-relaxed mb-4 mt-2">{excerpt}</p>
    </div>
  )
}
