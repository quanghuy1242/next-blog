import markdownStyles from './markdown-styles.module.css'
import Avatar from './avatar'

export default function PostBody({ content, author }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div
        className={markdownStyles['markdown']}
        dangerouslySetInnerHTML={{ __html: content }}
      />
      <div className="flex">
        <div className="flex-grow" />
        <Avatar name={author.name} picture={author.picture} />
      </div>
    </div>
  )
}
