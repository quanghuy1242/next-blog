import React from 'react';
import { render, screen } from '@testing-library/react';
import { Posts } from 'components/shared/posts';
import type { Post } from 'types/datocms';

function createPost(overrides: Partial<Post> = {}): Post {
  return {
    slug: overrides.slug ?? 'sample-post',
    title: overrides.title ?? 'Sample Title',
    date: overrides.date ?? '2024-01-01',
    excerpt: overrides.excerpt ?? 'Excerpt',
    coverImage: overrides.coverImage ?? { responsiveImage: {} as never },
    author:
      overrides.author ??
      ({ displayName: 'Author', picture: {} as never } as unknown as Post['author']),
    category: overrides.category ?? { name: 'Stories', slug: 'stories' },
    tags: overrides.tags ?? ['nextjs', 'react'],
    content: overrides.content ?? null,
    metadata: overrides.metadata ?? [],
    ogImage: overrides.ogImage,
  } as Post;
}

describe('Posts component', () => {
  test('renders provided posts with links', () => {
    const posts = [createPost({ slug: 'post-1', title: 'Post One' })];

    render(
      <Posts posts={posts} activeCategory="stories" activeTags={['nextjs']} />
    );

    expect(screen.getByText('Post One')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Stories' })).toHaveAttribute(
      'href',
      '/?category=stories'
    );
    expect(screen.getByRole('link', { name: 'nextjs' })).toHaveAttribute(
      'href',
      '/?category=stories&tag=nextjs'
    );
  });
});
