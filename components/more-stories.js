import PostPreview from '../components/post-preview'
import PostTitle from './post-title'

export default function MoreStories({ posts, colNum = 3, hasTitle = false }) {
  return (
    <section>
      {hasTitle && <PostTitle>More post:</PostTitle>}
      <div className={`grid grid-cols-1 md:grid-cols-${colNum} md:col-gap-10 lg:col-gap-10 row-gap-20 md:row-gap-20 mb-32`}>
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
