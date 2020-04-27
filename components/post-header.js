import Date from '../components/date'
import CoverImage from '../components/cover-image'
import PostTitle from '../components/post-title'

export default function PostHeader({ title, coverImage, date }) {
  return (
    <>
      <div className="mb-4 md:mb-4 -mx-5 sm:mx-0 h-banner overflow-hidden">
        <CoverImage
          title={title}
          responsiveImage={coverImage.responsiveImage}
        />
      </div>
      <div className="max-w-2xl mx-auto">
        <PostTitle>{title}</PostTitle>
        <div className="mb-6 text-sm text-gray-700">
          <Date dateString={date} />
        </div>
      </div>
    </>
  )
}
