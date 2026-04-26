import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { CategoriesRail } from 'components/shared/categories-rail';
import type { Category, Media } from 'types/cms';

vi.mock('common/utils/book-route-prefetch', () => ({
  requestBookRouteWarmup: vi.fn(),
}));

function createCategory(overrides: Partial<Category> = {}): Category {
  const image: Media = {
    id: 1,
    url: 'https://example.com/image.jpg',
    alt: 'Category image',
    width: 800,
    height: 400,
  };

  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Stories',
    slug: overrides.slug ?? 'stories',
    description: overrides.description ?? 'Category description',
    image: overrides.image ?? image,
    createdBy: overrides.createdBy ?? null,
    updatedAt: overrides.updatedAt ?? '2024-01-01',
    createdAt: overrides.createdAt ?? '2024-01-01',
  };
}

describe('CategoriesRail component', () => {
  test('renders Books card and category items', () => {
    render(
      <CategoriesRail
        categories={[createCategory({ name: 'Tech', slug: 'tech' })]}
        booksSubtext="Open bookshelf"
      />
    );

    expect(screen.getByRole('link', { name: /Books/i })).toHaveAttribute(
      'href',
      '/books'
    );
    expect(screen.getByRole('link', { name: /Tech/i })).toHaveAttribute(
      'href',
      '/?category=tech'
    );
    expect(screen.getByText('Open bookshelf')).toBeInTheDocument();
  });

  test('renders scroll controls', () => {
    render(<CategoriesRail categories={[createCategory()]} />);

    expect(
      screen.queryByRole('button', { name: 'Scroll categories left' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Scroll categories right' })
    ).not.toBeInTheDocument();
  });
});
