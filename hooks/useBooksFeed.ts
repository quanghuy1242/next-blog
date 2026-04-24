import { useCallback, useState } from 'react';
import type { Book } from 'types/cms';

interface UseBooksFeedParams {
  initialBooks: Book[];
  pageSize: number;
  initialHasMore: boolean;
  fetchImplementation?: typeof fetch;
}

interface PaginatedBooksApiResponse {
  books?: Book[];
  hasMore?: boolean;
  nextOffset?: number;
}

export interface BooksFeedState {
  books: Book[];
  offset: number;
  hasMore: boolean;
}

export interface UseBooksFeedResult {
  booksState: BooksFeedState;
  isFetching: boolean;
  error: string | null;
  loadMoreBooks: () => Promise<void>;
  retryLoadMore: () => Promise<void>;
}

const LOAD_MORE_ERROR = 'Unable to load more books right now. Tap to retry.';

export function useBooksFeed({
  initialBooks,
  pageSize,
  initialHasMore,
  fetchImplementation,
}: UseBooksFeedParams): UseBooksFeedResult {
  const fetchFn = fetchImplementation ?? globalThis.fetch;

  if (!fetchFn) {
    throw new Error('Fetch implementation is required to load books.');
  }

  const [booksState, setBooksState] = useState<BooksFeedState>({
    books: initialBooks,
    offset: initialBooks.length,
    hasMore: initialHasMore,
  });
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMoreBooks = useCallback(async () => {
    if (isFetching || !booksState.hasMore) {
      return;
    }

    const params = new URLSearchParams({
      limit: pageSize.toString(),
      offset: booksState.offset.toString(),
    });

    setIsFetching(true);
    setError(null);

    try {
      const response = await fetchFn(`/api/books?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as PaginatedBooksApiResponse;

      setBooksState((previous) => {
        const mergedBooks = mergeBooks(previous.books, payload.books ?? []);

        return {
          books: mergedBooks,
          offset: Math.max(
            payload.nextOffset ?? previous.offset,
            mergedBooks.length
          ),
          hasMore: payload.hasMore ?? previous.hasMore,
        };
      });
    } catch (loadError) {
      console.error('Failed to load more books', loadError);
      setError(LOAD_MORE_ERROR);
    } finally {
      setIsFetching(false);
    }
  }, [booksState.hasMore, booksState.offset, fetchFn, isFetching, pageSize]);

  const retryLoadMore = useCallback(async () => {
    await loadMoreBooks();
  }, [loadMoreBooks]);

  return {
    booksState,
    isFetching,
    error,
    loadMoreBooks,
    retryLoadMore,
  };
}

function mergeBooks(current: Book[], incoming: Book[]): Book[] {
  if (!incoming.length) {
    return current;
  }

  const seen = new Set(current.map((book) => book.slug));
  const merged = [...current];

  for (const book of incoming) {
    if (!seen.has(book.slug)) {
      seen.add(book.slug);
      merged.push(book);
    }
  }

  return merged;
}
