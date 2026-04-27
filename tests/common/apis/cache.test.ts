import { describe, expect, it } from 'vitest';

import {
  BOOKS_LIST_CACHE_TAG,
  buildBookCacheTags,
  buildBookDetailCacheTags,
  buildBooksListCacheTags,
  buildChapterPageCacheTags,
  buildChapterPageLookupCacheTags,
  buildChapterSlugCacheTags,
  buildChaptersByBookCacheTags,
  normalizeCacheTags,
} from '../../../common/apis/cache';

describe('cache tags', () => {
  it('normalizes and deduplicates tags', () => {
    expect(normalizeCacheTags([' books:list ', 'books:list', '', null, undefined, 'book:1'])).toEqual([
      'books:list',
      'book:1',
    ]);
  });

  it('builds book-related cache tags', () => {
    expect(buildBooksListCacheTags()).toEqual([BOOKS_LIST_CACHE_TAG]);
    expect(buildBookCacheTags(42)).toEqual(['book:42']);
    expect(buildBookCacheTags(undefined)).toEqual([]);
    expect(buildChapterSlugCacheTags(' chapter-seven ')).toEqual(['chapter:slug:chapter-seven']);
    expect(buildBookDetailCacheTags(42)).toEqual(['book:42', 'chapters:book:42']);
    expect(buildChaptersByBookCacheTags(42)).toEqual(['chapters:book:42']);
    expect(buildChapterPageLookupCacheTags(42, ' chapter-seven ')).toEqual([
      'chapter-page:book:42:chapter-seven',
      'book:42',
      'chapter:slug:chapter-seven',
      'chapters:book:42',
    ]);
  });

  it('builds chapter-related cache tags', () => {
    expect(buildChapterPageCacheTags(42, 7)).toEqual([
      'book:42',
      'chapter:7',
      'chapters:book:42',
    ]);
  });
});
