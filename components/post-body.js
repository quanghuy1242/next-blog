import markdownStyles from './markdown-styles.module.css'
import Avatar from './avatar'
import TagList from './tag-list'

export default function PostBody({ content, author, tags }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div
        className={markdownStyles['markdown']}
        dangerouslySetInnerHTML={{ __html: content }}
      />
      <div className="flex mb-2">
        <div className="flex-grow" />
        <Avatar name={author.name} picture={author.picture} />
      </div>
      {!!tags.length && <TagList items={tags} />}
    </div>
  )
}
