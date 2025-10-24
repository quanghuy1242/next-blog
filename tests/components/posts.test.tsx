import React from 'react';
import { render, screen } from '@testing-library/react';
import { Posts } from 'components/shared/posts';
import type { Post } from 'types/cms';

function createPost(overrides: Partial<Post> = {}): Post {
  return {
    id: overrides.id ?? 1,
    slug: overrides.slug ?? 'sample-post',
    title: overrides.title ?? 'Sample Title',
    createdAt: overrides.createdAt ?? '2024-01-01',
    updatedAt: overrides.updatedAt ?? '2024-01-01',
    excerpt: overrides.excerpt ?? 'Excerpt',
    coverImage: overrides.coverImage ?? null,
    author: overrides.author ?? null,
    category: overrides.category ?? {
      id: 1,
      name: 'Stories',
      slug: 'stories',
      description: '',
      image: {} as never,
    },
    tags: overrides.tags ?? [{ tag: 'nextjs' }, { tag: 'react' }],
    content: overrides.content ?? null,
    meta: overrides.meta ?? null,
    _status: overrides._status ?? 'published',
  };
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
