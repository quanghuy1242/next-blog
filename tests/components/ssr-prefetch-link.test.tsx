import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { SSRPrefetchLink } from '@/components/shared/ssr-prefetch-link';

vi.mock('next/link', () => ({
  default: React.forwardRef<
    HTMLAnchorElement,
    React.AnchorHTMLAttributes<HTMLAnchorElement> & {
      href: string;
      prefetch?: boolean;
    }
  >(function MockLink({ href, children, prefetch: _prefetch, ...rest }, ref) {
    void _prefetch;

    return (
      <a
        ref={ref}
        href={href}
        {...rest}
      >
        {children}
      </a>
    );
  }),
}));

describe('SSRPrefetchLink component', () => {
  test('renders the target href', () => {
    render(<SSRPrefetchLink href="/books/1~sample-book">Sample Book</SSRPrefetchLink>);

    expect(screen.getByRole('link', { name: 'Sample Book' })).toHaveAttribute(
      'href',
      '/books/1~sample-book'
    );
  });

  test('passes through click handlers', () => {
    const onClick = vi.fn();

    render(
      <SSRPrefetchLink href="/books/1~sample-book" onClick={onClick}>
        Sample Book
      </SSRPrefetchLink>
    );

    fireEvent.click(screen.getByRole('link', { name: 'Sample Book' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
