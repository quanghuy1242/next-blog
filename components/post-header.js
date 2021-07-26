import Date from 'components/date'
import CoverImage from 'components/cover-image'
import PostTitle from 'components/post-title'
import Badge from './badge'

export default function PostHeader({ title, coverImage, date, category }) {
  return (
    <>
      <div className="mb-2 mx-0 h-banner overflow-hidden">
        <CoverImage
          title={title}
          responsiveImage={coverImage.responsiveImage}
        />
      </div>
      <div className="max-w-2xl mx-auto">
        <PostTitle>{title}</PostTitle>
        <div className="mb-2 text-sm text-gray-700 text-center md:text-left">
          <Date dateString={date} />
        </div>
        <div className="mb-6 text-center md:text-left">
          <Badge text={category.name} link={{ as: `/`, href: '/' }} />
        </div>
      </div>
    </>
  )
}
