import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ChapterToc } from 'components/pages/books/chapter-toc';
import type { Chapter } from 'types/cms';
import { requestRouteWarmup } from 'common/utils/route-prefetch';

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

vi.mock('next/link', () => ({
  default: React.forwardRef<
    HTMLAnchorElement,
    React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
  >(function MockLink({ href, children, ...rest }, ref) {
    return (
      <a
        ref={ref}
        href={href}
        {...rest}
        onClick={(event) => {
          rest.onClick?.(event);
          event.preventDefault();
        }}
      >
        {children}
      </a>
    );
  }),
}));

const mockedRequestRouteWarmup = vi.mocked(requestRouteWarmup);

function createChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: overrides.id ?? 1,
    title: overrides.title ?? 'Chapter 1',
    book: overrides.book ?? 1,
    order: overrides.order ?? 1,
    slug: overrides.slug ?? 'chapter-1',
    chapterSourceKey: overrides.chapterSourceKey ?? null,
    chapterSourceHash: overrides.chapterSourceHash ?? null,
    importBatchId: overrides.importBatchId ?? null,
    manualEditedAt: overrides.manualEditedAt ?? null,
    content:
      overrides.content ??
      ({
        root: {
          children: [],
          direction: null,
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        },
      } as never),
    createdBy: overrides.createdBy ?? null,
    _status: overrides._status ?? 'published',
    updatedAt: overrides.updatedAt ?? '2024-01-01',
    createdAt: overrides.createdAt ?? '2024-01-01',
  };
}

describe('ChapterToc component', () => {
  beforeEach(() => {
    mockedRequestRouteWarmup.mockReset();
  });

  test('highlights current chapter with simple sidebar styling', () => {
    const chapters = [
      createChapter({ slug: 'ch-1', title: 'One', order: 1 }),
      createChapter({ id: 2, slug: 'ch-2', title: 'Two', order: 2 }),
    ];

    render(
      <ChapterToc
        chapters={chapters}
        bookId={1}
        bookSlug="sample-book"
        currentChapterSlug="ch-2"
      />
    );

    const activeLink = screen.getByRole('link', { name: /Two/i });
    expect(activeLink.className).toContain('font-semibold');
    expect(activeLink).toHaveAttribute('href', '/books/1~sample-book/chapters/ch-2');
    expect(activeLink.className).toContain('text-gray-900');
    expect(activeLink.className).not.toContain('bg-blue');
  });

  test('calls onNavigate when a chapter is clicked', () => {
    const onNavigate = vi.fn();
    const chapters = [createChapter({ slug: 'ch-1', title: 'One' })];

    render(
      <ChapterToc
        chapters={chapters}
        bookId={1}
        bookSlug="sample-book"
        currentChapterSlug="ch-1"
        onNavigate={onNavigate}
      />
    );

    fireEvent.click(screen.getByRole('link', { name: /One/i }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
