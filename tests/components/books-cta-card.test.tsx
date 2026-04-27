import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { BooksCtaCard } from 'components/shared/books-cta-card';

const defaultRouteWarmupPolicyState = {
  allowHoverWarmup: true,
  allowPointerWarmup: true,
  allowViewportWarmup: true,
  disableWarmup: false,
  pauseSpeculativeWarmup: false,
};

vi.mock('common/utils/route-prefetch', () => ({
  cancelRouteWarmup: vi.fn(),
  claimRouteWarmup: vi.fn(),
  getRouteWarmupPolicyState: vi.fn(() => defaultRouteWarmupPolicyState),
  pauseSpeculativeRouteWarmupsUntilUserActivity: vi.fn(),
  requestRouteWarmup: vi.fn(),
  subscribeRouteWarmupPolicy: vi.fn(() => () => {}),
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
