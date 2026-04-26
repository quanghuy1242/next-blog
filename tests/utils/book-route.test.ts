import { describe, expect, test } from 'vitest';
import {
  buildBookHref,
  buildBookRouteSegment,
  buildChapterHref,
  parseBookRouteSegment,
} from 'common/utils/book-route';

describe('book route helpers', () => {
  test('builds canonical book and chapter hrefs', () => {
    expect(buildBookRouteSegment(12, 'sample-book')).toBe('12~sample-book');
    expect(buildBookHref(12, 'sample-book')).toBe('/books/12~sample-book');
    expect(buildChapterHref(12, 'sample-book', 'chapter-1', 'section-3')).toBe(
      '/books/12~sample-book/chapters/chapter-1#section-3'
    );
  });

  test('parses canonical and legacy book route segments', () => {
    expect(parseBookRouteSegment('12~sample-book')).toEqual({
      bookId: 12,
      bookSlug: 'sample-book',
      isLegacySlugOnly: false,
    });

    expect(parseBookRouteSegment('sample-book')).toEqual({
      bookId: null,
      bookSlug: 'sample-book',
      isLegacySlugOnly: true,
    });
  });
});
