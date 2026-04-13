import React from 'react';
import { render, screen } from '@testing-library/react';
import { BooksCtaCard } from 'components/shared/books-cta-card';
import type { Media } from 'types/cms';

describe('BooksCtaCard component', () => {
  test('renders books CTA link', () => {
    const media: Media = {
      id: 1,
      url: 'https://example.com/books.jpg',
      alt: 'Books cover',
    };

    render(<BooksCtaCard media={media} subtext="Open the shelf" />);

    expect(screen.getByRole('link', { name: /Books/i })).toHaveAttribute(
      'href',
      '/books'
    );
    expect(screen.getByText('Open the shelf')).toBeInTheDocument();
  });
});
