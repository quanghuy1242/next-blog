import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { BooksCtaCard } from 'components/shared/books-cta-card';

vi.mock('common/utils/route-prefetch', () => ({
  claimRouteWarmup: vi.fn(),
  requestRouteWarmup: vi.fn(),
}));

describe('BooksCtaCard component', () => {
  test('renders books CTA link and reveals text on hover', () => {
    render(<BooksCtaCard subtext="Open the shelf" />);

    const booksLink = screen.getByRole('link', { name: /Books/i });
    const shelfText = screen.getByText('Open the shelf');

    expect(booksLink).toHaveAttribute(
      'href',
      '/books'
    );

    expect(shelfText.className).toContain('opacity-0');

    fireEvent.mouseEnter(booksLink);

    expect(shelfText.className).toContain('opacity-100');
    expect(screen.getByAltText('Books banner')).toHaveAttribute(
      'src',
      expect.stringContaining('payload-cdn.quanghuy.dev')
    );
  });
});
