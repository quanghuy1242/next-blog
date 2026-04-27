import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchAPIWithAuthToken } from 'common/apis/base';
import { getBookBySlug, getBookDetailById, getBookDetailBySlug } from 'common/apis/books';

vi.mock('common/apis/base', () => ({
  fetchAPIWithAuthToken: vi.fn(),
}));

const mockedFetchAPIWithAuthToken = vi.mocked(fetchAPIWithAuthToken);

describe('common/apis/books', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test('short-circuits when the book slug is blank', async () => {
    await expect(getBookBySlug('   ')).resolves.toEqual({
      book: null,
      homepage: null,
    });

    expect(mockedFetchAPIWithAuthToken).not.toHaveBeenCalled();
  });

  test('composes the book detail and chapter list loaders', async () => {
    mockedFetchAPIWithAuthToken
      .mockResolvedValueOnce({
        Books: {
          docs: [
            {
              id: 42,
              title: 'Sample Book',
              slug: 'sample-book',
              author: 'Author',
            },
          ],
        },
        Homepage: { header: 'Books' },
      } as never)
      .mockResolvedValueOnce({
        Chapters: {
          docs: [
            {
              id: 2,
              title: 'Second Chapter',
              slug: 'second-chapter',
              order: 2,
              book: 42,
              content: {},
              createdAt: '2024-01-02',
            },
            {
              id: 1,
              title: 'First Chapter',
              slug: 'first-chapter',
              order: 1,
              book: 42,
              content: {},
              createdAt: '2024-01-01',
            },
          ],
        },
      } as never);

    const result = await getBookDetailBySlug('sample-book');

    expect(result.book?.slug).toBe('sample-book');
    expect(result.homepage).toEqual({ header: 'Books' });
    expect(result.chapters.map((chapter) => chapter.slug)).toEqual([
      'first-chapter',
      'second-chapter',
    ]);
    expect(mockedFetchAPIWithAuthToken).toHaveBeenCalledTimes(2);
  });

  test('attaches slug cache tags even when a book lookup misses', async () => {
    mockedFetchAPIWithAuthToken.mockResolvedValueOnce({
      Books: {
        docs: [],
      },
      Homepage: null,
    } as never);

    await getBookBySlug('missing-book');

    const [, config] = mockedFetchAPIWithAuthToken.mock.calls[0] ?? [];
    expect(config?.getCacheTags?.({ Books: { docs: [] } } as never)).toEqual([
      'book:slug:missing-book',
    ]);
  });

  test('loads the canonical book detail page in one request by id', async () => {
    mockedFetchAPIWithAuthToken.mockResolvedValueOnce({
      Books: {
        docs: [
          {
            id: 42,
            title: 'Sample Book',
            slug: 'sample-book',
            author: 'Author',
          },
        ],
      },
      Chapters: {
        docs: [
          {
            id: 2,
            title: 'Second Chapter',
            slug: 'second-chapter',
            order: 2,
            book: 42,
            content: {},
            createdAt: '2024-01-02',
          },
          {
            id: 1,
            title: 'First Chapter',
            slug: 'first-chapter',
            order: 1,
            book: 42,
            content: {},
            createdAt: '2024-01-01',
          },
        ],
      },
      Homepage: { header: 'Books' },
    } as never);

    const result = await getBookDetailById(42);

    expect(result.book?.slug).toBe('sample-book');
    expect(result.homepage).toEqual({ header: 'Books' });
    expect(result.chapters.map((chapter) => chapter.slug)).toEqual([
      'first-chapter',
      'second-chapter',
    ]);
    expect(mockedFetchAPIWithAuthToken).toHaveBeenCalledTimes(1);

    const [query, config] = mockedFetchAPIWithAuthToken.mock.calls[0] ?? [];
    expect(String(query)).toContain(
      'query BookDetailWithChaptersByBookId($bookId: Int!, $bookRelationId: JSON!)'
    );
    expect(config?.variables).toEqual({
      bookId: 42,
      bookRelationId: 42,
    });
  });
});
