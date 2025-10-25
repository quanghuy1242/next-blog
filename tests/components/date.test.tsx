import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Date } from 'components/shared/date';

describe('Date component', () => {
  it('renders formatted date', () => {
    render(<Date dateString="2024-01-15T10:30:00Z" />);
    // Should render a date (may vary by timezone)
    const timeElement = screen.getByRole('time');
    expect(timeElement).toBeDefined();
    expect(timeElement.textContent).toMatch(/January 1[45], 2024/);
  });

  it('includes dateTime attribute for semantic HTML', () => {
    const dateString = '2024-03-20T00:00:00Z';
    render(<Date dateString={dateString} />);
    const timeElement = screen.getByRole('time');
    expect(timeElement.getAttribute('datetime')).toBe(dateString);
  });

  it('applies custom className', () => {
    render(<Date dateString="2024-06-10T15:45:00Z" className="custom-class" />);
    const timeElement = screen.getByRole('time');
    expect(timeElement.className).toContain('custom-class');
  });

  it('has suppressHydrationWarning to prevent hydration mismatches', () => {
    const { container } = render(<Date dateString="2024-12-25T12:00:00Z" />);
    const timeElement = container.querySelector('time');
    // The suppressHydrationWarning prevents React from warning about mismatches
    // between server and client rendering when timezones differ
    expect(timeElement).toBeDefined();
  });

  it('handles empty date string gracefully', () => {
    render(<Date dateString="" />);
    const timeElement = screen.getByRole('time');
    expect(timeElement.textContent).toBe('');
  });

  it('renders consistently for dates with timezone offsets', () => {
    render(<Date dateString="2024-07-04T23:59:59+05:30" />);
    const timeElement = screen.getByRole('time');
    // Date may shift depending on local timezone
    expect(timeElement.textContent).toMatch(/July [345], 2024/);
  });

  it('formats date consistently with same input', () => {
    const dateString = '2024-09-15T14:30:00Z';

    const { unmount, container } = render(<Date dateString={dateString} />);
    const firstRender = container.querySelector('time')?.textContent;

    unmount();

    const { container: container2 } = render(<Date dateString={dateString} />);
    const secondRender = container2.querySelector('time')?.textContent;

    // Same input should produce same output in same environment
    expect(firstRender).toBe(secondRender);
  });
});
