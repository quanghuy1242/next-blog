import PostPreview from '../components/post-preview'
import PostTitle from './post-title'
import cn from 'classnames'

export default function MoreStories({ posts, hasMoreCol = true, hasTitle = false }) {
  return (
    <section>
      {hasTitle && <PostTitle>More post:</PostTitle>}
      <div className={cn('grid grid-cols-1 md:col-gap-10 lg:col-gap-10 row-gap-20 md:row-gap-20 mb-32', {
        'md:grid-cols-3': hasMoreCol,
        'md:grid-cols-2': !hasMoreCol
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
          />
        ))}
      </div>
    </section>
  )
}
