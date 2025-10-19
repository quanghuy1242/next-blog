import React from 'react';
import { render, screen } from '@testing-library/react';
import { Categories } from 'components/shared/categories';
import type { Category } from 'types/datocms';

function createCategory(overrides: Partial<Category> = {}): Category {
  return {
    name: overrides.name ?? 'Stories',
    slug: overrides.slug ?? 'stories',
    description: overrides.description ?? 'Description',
    image:
      overrides.image ?? ({ responsiveImage: {} as never } as Category['image']),
  } as Category;
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
