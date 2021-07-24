import Avatar from './avatar'
import TagList from './tag-list'

export default function PostBody({ content, author, tags }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div
        className="prose mb-4"
        dangerouslySetInnerHTML={{ __html: content }}
      />
      {!!tags.length && <TagList items={tags} />}
    </div>
  )
}
