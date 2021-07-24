import PostPreview from '../components/post-preview'
import PostTitle from './post-title'
import cn from 'classnames'

export default function MoreStories({ posts, hasMoreCol = true, hasTitle = false }) {
  return (
    <section>
      {hasTitle && <PostTitle>More post:</PostTitle>}
      <div className={cn('grid grid-cols-1 md:gap-x-10 lg:gap-x-10 gap-y-10 md:gap-y-10 mb-32', {
        'md:grid-cols-2': hasMoreCol,
        'md:grid-cols-1': !hasMoreCol
      })}>
        {posts.map(post => (
          <PostPreview
            key={post.slug}
            title={post.title}
            coverImage={post.coverImage}
            date={post.date}
            author={post.author}
            slug={post.slug}
            excerpt={post.excerpt}
            category={post.category}
            tags={post.tags.split(', ').filter(Boolean)}
          />
        ))}
      </div>
    </section>
  )
}
