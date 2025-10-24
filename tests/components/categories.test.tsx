import React from 'react';
import { render, screen } from '@testing-library/react';
import { Categories } from 'components/shared/categories';
import type { Category } from 'types/cms';

function createCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Stories',
    slug: overrides.slug ?? 'stories',
    description: overrides.description ?? 'Description',
    image: overrides.image ?? {
      id: 1,
      url: 'https://example.com/image.jpg',
      alt: 'Image',
      width: 800,
      height: 600,
    },
    createdBy: overrides.createdBy ?? null,
    createdAt: overrides.createdAt ?? '2024-01-01',
    updatedAt: overrides.updatedAt ?? '2024-01-01',
  };
}

describe('Categories component', () => {
  test('renders category links pointing to filtered homepage', () => {
    const categories = [createCategory({ name: 'Tech', slug: 'tech' })];

    render(<Categories categories={categories} />);

    const link = screen.getByRole('link', { name: /Tech/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/?category=tech');
  });
});
