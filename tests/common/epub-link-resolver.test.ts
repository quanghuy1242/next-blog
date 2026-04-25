import { describe, expect, test } from 'vitest';

import {
  normalizeEpubPath,
  resolveEpubHref,
  splitEpubHref,
} from 'common/utils/epub-link-resolver';

const chapters = [
  {
    slug: 'front-matter',
    chapterSourceKey: 'toc-front::OEBPS/Text/fm.htm::chapter-1',
  },
  {
    slug: 'chapter-one',
    chapterSourceKey: 'toc-1::OEBPS/Text/01.htm::chapter-2',
  },
  {
    slug: 'chapter-two',
    chapterSourceKey: 'toc-2::OEBPS/Text/02.htm::chapter-3',
  },
];

describe('epub link resolver', () => {
  test('splits hrefs into path and fragment parts', () => {
    expect(splitEpubHref('../Text/02.htm#pgfId-1011849')).toEqual({
      pathPart: '../Text/02.htm',
      fragment: 'pgfId-1011849',
    });
  });

  test('normalizes relative paths for chapter matching', () => {
    expect(normalizeEpubPath('../Text/02.htm?foo=1')).toBe('text/02.htm');
    expect(normalizeEpubPath('./../Text/../Text/01.htm')).toBe('text/01.htm');
  });

  test('resolves chapter links and preserves hash fragments', () => {
    expect(
      resolveEpubHref('../Text/02.htm#pgfId-1011849', chapters, 'sample-book')
    ).toEqual({
      kind: 'chapter',
      href: '/books/sample-book/chapters/chapter-two#pgfId-1011849',
      fragment: 'pgfId-1011849',
    });
  });

  test('resolves fragment-only anchors without chapter lookup', () => {
    expect(resolveEpubHref('#section-3', chapters, 'sample-book')).toEqual({
      kind: 'anchor',
      href: '#section-3',
      fragment: 'section-3',
    });
  });

  test('falls back to unresolved when the source chapter cannot be matched', () => {
    expect(resolveEpubHref('../Text/missing.htm#section', chapters, 'sample-book')).toEqual({
      kind: 'unresolved',
    });
  });

  test('does not guess when multiple chapters share the same basename', () => {
    expect(
      resolveEpubHref(
        'index.htm#section',
        [
          {
            slug: 'appendix-a',
            chapterSourceKey: 'toc-a::OEBPS/Text/appendix/index.htm::chapter-9',
          },
          {
            slug: 'appendix-b',
            chapterSourceKey: 'toc-b::OEBPS/Other/index.htm::chapter-10',
          },
        ],
        'sample-book'
      )
    ).toEqual({
      kind: 'unresolved',
    });
  });
});
