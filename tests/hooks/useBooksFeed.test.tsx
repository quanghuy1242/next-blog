import { renderHook, act, waitFor } from '@testing-library/react';
import { useBooksFeed } from 'hooks/useBooksFeed';
import type { Book } from 'types/cms';
import { vi } from 'vitest';

function createBook(overrides: Partial<Book> = {}): Book {
  return {
    id: overrides.id ?? 1,
    title: overrides.title ?? 'Book Title',
    slug: overrides.slug ?? 'book-title',
    author: overrides.author ?? 'Author',
    cover: overrides.cover ?? null,
    origin: overrides.origin ?? 'manual',
    sourceType: overrides.sourceType ?? 'manual',
    sourceId: overrides.sourceId ?? null,
    sourceHash: overrides.sourceHash ?? null,
    sourceVersion: overrides.sourceVersion ?? null,
    syncStatus: overrides.syncStatus ?? 'clean',
    importBatchId: overrides.importBatchId ?? null,
    importStatus: overrides.importStatus ?? 'idle',
    importTotalChapters: overrides.importTotalChapters ?? null,
    importCompletedChapters: overrides.importCompletedChapters ?? null,
    importStartedAt: overrides.importStartedAt ?? null,
    importFinishedAt: overrides.importFinishedAt ?? null,
    importFailedAt: overrides.importFailedAt ?? null,
    lastImportedAt: overrides.lastImportedAt ?? null,
    importErrorSummary: overrides.importErrorSummary ?? null,
    createdBy: overrides.createdBy ?? null,
    _status: overrides._status ?? 'published',
    updatedAt: overrides.updatedAt ?? '2024-01-01',
    createdAt: overrides.createdAt ?? '2024-01-01',
  };
}

describe('useBooksFeed', () => {
  test('initializes from provided state', () => {
    const initialBooks = [createBook({ slug: 'initial-book' })];

    const { result } = renderHook(() =>
      useBooksFeed({
        initialBooks,
        initialHasMore: true,
        pageSize: 6,
        fetchImplementation: vi.fn() as unknown as typeof fetch,
      })
    );

    expect(result.current.booksState.books).toEqual(initialBooks);
    expect(result.current.booksState.offset).toBe(1);
    expect(result.current.booksState.hasMore).toBe(true);
  });

  test('appends unique books when loading more', async () => {
    const initialBooks = [createBook({ slug: 'book-1' })];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        books: [createBook({ id: 2, slug: 'book-2' }), createBook({ id: 1, slug: 'book-1' })],
        hasMore: false,
        nextOffset: 2,
      }),
    });

    const { result } = renderHook(() =>
      useBooksFeed({
        initialBooks,
        initialHasMore: true,
        pageSize: 6,
        fetchImplementation: fetchMock as unknown as typeof fetch,
      })
    );

    await act(async () => {
      await result.current.loadMoreBooks();
    });

    await waitFor(() => {
      expect(result.current.booksState.books.map((book) => book.slug)).toEqual([
        'book-1',
        'book-2',
      ]);
    });

    expect(result.current.booksState.hasMore).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('offset=1'), {
      credentials: 'include',
    });
  });

  test('sets error when load fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const { result } = renderHook(() =>
      useBooksFeed({
        initialBooks: [createBook()],
        initialHasMore: true,
        pageSize: 6,
        fetchImplementation: fetchMock as unknown as typeof fetch,
      })
    );

    await act(async () => {
      await result.current.retryLoadMore();
    });

    await waitFor(() => {
      expect(result.current.error).toBe(
        'Unable to load more books right now. Tap to retry.'
      );
    });
  });
});
