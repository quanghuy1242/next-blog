import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchAPIWithAuthToken } from 'common/apis/base';
import { getChapterBySlug, getChapterPageByBookId } from 'common/apis/chapters';

vi.mock('common/apis/base', () => ({
  fetchAPIWithAuthToken: vi.fn(),
}));

const mockedFetchAPIWithAuthToken = vi.mocked(fetchAPIWithAuthToken);

describe('common/apis/chapters', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test('short-circuits when the chapter slug is blank', async () => {
    await expect(getChapterBySlug('')).resolves.toEqual({
      chapter: null,
      homepage: null,
    });

    expect(mockedFetchAPIWithAuthToken).not.toHaveBeenCalled();
  });

  test('loads the chapter and homepage in one request', async () => {
    mockedFetchAPIWithAuthToken.mockResolvedValueOnce({
      Chapters: {
        docs: [
          {
            id: 7,
            title: 'Chapter Seven',
            slug: 'chapter-seven',
            order: 7,
            book: 42,
            content: {},
            createdAt: '2024-01-07',
          },
        ],
      },
      Homepage: { header: 'Books' },
    } as never);

    const result = await getChapterBySlug('chapter-seven');

    expect(result.chapter?.slug).toBe('chapter-seven');
    expect(result.homepage).toEqual({ header: 'Books' });
    expect(mockedFetchAPIWithAuthToken).toHaveBeenCalledTimes(1);
  });

  test('attaches slug cache tags even when a chapter lookup misses', async () => {
    mockedFetchAPIWithAuthToken.mockResolvedValueOnce({
      Chapters: {
        docs: [],
      },
      Homepage: null,
    } as never);

    await getChapterBySlug('missing-chapter');

    const [, config] = mockedFetchAPIWithAuthToken.mock.calls[0] ?? [];
    expect(config?.getCacheTags?.({ Chapters: { docs: [] } } as never)).toEqual([
      'chapter:slug:missing-chapter',
    ]);
  });

  test('loads the canonical chapter page in one request by book id', async () => {
    mockedFetchAPIWithAuthToken.mockResolvedValueOnce({
      ChapterMatch: {
        docs: [
          {
            id: 7,
            title: 'Chapter Seven',
            slug: 'chapter-seven',
            order: 7,
            book: {
              id: 42,
              title: 'Sample Book',
              slug: 'sample-book',
              author: 'Author',
            },
            content: {},
            createdAt: '2024-01-07',
          },
        ],
      },
      ChaptersByBook: {
        docs: [
          {
            id: 8,
            title: 'Chapter Eight',
            slug: 'chapter-eight',
            order: 8,
            book: 42,
            content: {},
            createdAt: '2024-01-08',
          },
          {
            id: 7,
            title: 'Chapter Seven',
            slug: 'chapter-seven',
            order: 7,
            book: 42,
            content: {},
            createdAt: '2024-01-07',
          },
        ],
      },
      Homepage: { header: 'Books' },
    } as never);

    const result = await getChapterPageByBookId(42, 'chapter-seven');

    expect(result.book?.slug).toBe('sample-book');
    expect(result.chapter?.slug).toBe('chapter-seven');
    expect(result.chapters.map((chapter) => chapter.slug)).toEqual([
      'chapter-seven',
      'chapter-eight',
    ]);
    expect(result.homepage).toEqual({ header: 'Books' });
    expect(mockedFetchAPIWithAuthToken).toHaveBeenCalledTimes(1);
  });

  test('attaches route cache tags even when the canonical chapter page misses', async () => {
    mockedFetchAPIWithAuthToken.mockResolvedValueOnce({
      ChapterMatch: {
        docs: [],
      },
      ChaptersByBook: {
        docs: [],
      },
      Homepage: null,
    } as never);

    await getChapterPageByBookId(42, 'missing-chapter');

    const [, config] = mockedFetchAPIWithAuthToken.mock.calls[0] ?? [];
    expect(config?.getCacheTags?.({
      ChapterMatch: {
        docs: [],
      },
    } as never)).toEqual([
      'chapter-page:book:42:missing-chapter',
      'book:42',
      'chapter:slug:missing-chapter',
      'chapters:book:42',
    ]);
  });
});
