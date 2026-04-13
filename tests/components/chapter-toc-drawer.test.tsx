import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChapterTocDrawer } from 'components/pages/books/chapter-toc-drawer';

describe('ChapterTocDrawer component', () => {
  test('does not render when closed', () => {
    render(
      <ChapterTocDrawer isOpen={false} onClose={vi.fn()}>
        <div>Content</div>
      </ChapterTocDrawer>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('renders when open and closes from backdrop click', () => {
    const onClose = vi.fn();

    render(
      <ChapterTocDrawer isOpen={true} onClose={onClose}>
        <div>Content</div>
      </ChapterTocDrawer>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Close chapter table of contents' })
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('closes on Escape key', () => {
    const onClose = vi.fn();

    render(
      <ChapterTocDrawer isOpen={true} onClose={onClose}>
        <div>Content</div>
      </ChapterTocDrawer>
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('locks background scrolling while open', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <ChapterTocDrawer isOpen={true} onClose={onClose}>
        <div>Content</div>
      </ChapterTocDrawer>
    );

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });
});
