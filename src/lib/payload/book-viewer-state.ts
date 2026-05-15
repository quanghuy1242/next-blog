import 'server-only';

import type {
  Book,
  BookmarkRecord,
  Chapter,
  ReadingProgressRecord,
} from '@/types/cms';
import { getContinueReadingChapterSlug } from '@/lib/reading/continue-reading';
import { calculateWholeBookProgress } from '@/lib/reading/reading-progress';
import { fetchAPIWithAuthToken } from './base';
import { fetchBookPageViewerPayload } from './book-pages';
import { getChapterProgressMetadataByBookIds } from './chapters';
import { getReadingProgressByBookIds } from './reading-progress';
import type { PayloadCacheSettings } from './cache';

const BOOKMARK_RECORD_FIELDS = `
  id
  contentType
  chapter(draft: true) {
    ... on Chapter {
      id
      title
      slug
      book(draft: true) {
        ... on Book {
          id
          title
          slug
        }
      }
    }
  }
  book(draft: true) {
    ... on Book {
      id
      title
      slug
    }
  }
`;

interface BookmarksByBookIdsResponse {
  Bookmarks: {
    docs: BookmarkRecord[];
  } | null;
}

export interface BookCardViewerState {
  bookId: number;
  isBookmarked: boolean;
  bookmarkId: number | null;
  readingProgressPct: number;
}

export interface BookDetailViewerState {
  bookId: number;
  bookmark: BookmarkRecord | null;
  readingProgress: ReadingProgressRecord[];
  readingProgressByChapterId?: Record<number, number>;
  continueReadingChapterSlug: string | null;
  wholeBookProgress: number;
}

export interface ChapterViewerState {
  bookmark: BookmarkRecord | null;
  readingProgress: ReadingProgressRecord[];
  readingProgressByChapterId?: Record<number, number>;
}

/**
 * Server-side aggregation for live book-card state.
 *
 * This helper intentionally returns only UI-ready viewer fields. It is called by
 * no-store route handlers after the page shell renders, not by the main page loaders.
 */
export async function getBookCardsViewerState(
  bookIds: number[],
  options: {
    authToken?: string | null;
    cache?: PayloadCacheSettings;
    draftMode?: boolean;
  } = {}
): Promise<BookCardViewerState[]> {
  const uniqueBookIds = normalizeIds(bookIds);

  if (!options.authToken || uniqueBookIds.length === 0) {
    return [];
  }

  const [chaptersByBookId, progressEntries, bookmarks] = await Promise.all([
    getChapterProgressMetadataByBookIds(uniqueBookIds, {
      authToken: options.authToken,
      cache: options.cache,
      draftMode: options.draftMode,
    }),
    getReadingProgressByBookIds(uniqueBookIds, {
      authToken: options.authToken,
    }),
    getBookBookmarksByBookIds(uniqueBookIds, options.authToken),
  ]);
  const bookmarkByBookId = new Map(
    bookmarks
      .map((bookmark) => {
        const bookId = bookmark.book?.id;
        return typeof bookId === 'number' ? [bookId, bookmark] as const : null;
      })
      .filter((entry): entry is readonly [number, BookmarkRecord] => entry != null)
  );

  return uniqueBookIds.map((bookId) => {
    const bookmark = bookmarkByBookId.get(bookId) ?? null;

    return {
      bookId,
      isBookmarked: bookmark != null,
      bookmarkId: bookmark?.id ?? null,
      readingProgressPct: calculateWholeBookProgress({
        chapters: chaptersByBookId[bookId] ?? [],
        records: progressEntries.get(bookId) ?? [],
      }),
    };
  });
}

/**
 * Builds the detail-page viewer state that used to block `/books/[slug]`.
 * Keep this behind `/api/books/viewer-state?detail=1` so content rendering stays fast.
 */
export async function getBookDetailViewerState(
  book: Pick<Book, 'id' | 'totalWordCount'>,
  chapters: Array<Pick<Chapter, 'id' | 'slug' | 'chapterWordCount'>>,
  options: { authToken?: string | null } = {}
): Promise<BookDetailViewerState> {
  if (!options.authToken) {
    return emptyBookDetailViewerState(book.id);
  }

  const viewerPayload = await fetchBookPageViewerPayload(book.id, {
    authToken: options.authToken,
  });
  const readingProgress = viewerPayload.readingProgress;

  return {
    bookId: book.id,
    bookmark: viewerPayload.bookmark,
    readingProgress,
    readingProgressByChapterId: buildReadingProgressByChapterId(readingProgress),
    continueReadingChapterSlug: getContinueReadingChapterSlug(chapters, readingProgress),
    wholeBookProgress: calculateWholeBookProgress({
      chapters,
      records: readingProgress,
      totalWordCount: book.totalWordCount,
    }),
  };
}

/**
 * Builds the reader-specific viewer state that used to block chapter pages.
 * Comments are intentionally not included; they load through the comments client below
 * the article content.
 */
export async function getChapterViewerState(
  bookId: number,
  chapterId: number,
  options: { authToken?: string | null } = {}
): Promise<ChapterViewerState> {
  if (!options.authToken) {
    return emptyChapterViewerState();
  }

  const data = await fetchAPIWithAuthToken<{
    readingProgress: { records: ReadingProgressRecord[] } | null;
    Bookmarks: { docs: BookmarkRecord[] } | null;
  }>(
    `#graphql
      query ChapterViewerState(
        $readingProgressBookId: ID!
        $bookmarkWhere: Bookmark_where
      ) {
        readingProgress(bookId: $readingProgressBookId) {
          records {
            chapterId
            progress
            completedAt
            updatedAt
          }
        }

        Bookmarks(where: $bookmarkWhere, limit: 1) {
          docs {
            ${BOOKMARK_RECORD_FIELDS}
          }
        }
      }
    `,
    {
      variables: {
        readingProgressBookId: String(bookId),
        bookmarkWhere: {
          AND: [
            { contentType: { equals: 'chapter' } },
            { chapter: { equals: String(chapterId) } },
          ],
        },
      },
      authToken: options.authToken,
    }
  );
  const readingProgress = data?.readingProgress?.records ?? [];

  return {
    bookmark: data?.Bookmarks?.docs?.[0] ?? null,
    readingProgress,
    readingProgressByChapterId: buildReadingProgressByChapterId(readingProgress),
  };
}

async function getBookBookmarksByBookIds(
  bookIds: number[],
  authToken: string
): Promise<BookmarkRecord[]> {
  if (!bookIds.length) {
    return [];
  }

  const data = await fetchAPIWithAuthToken<BookmarksByBookIdsResponse>(
    `#graphql
      query BookBookmarksByBookIds($where: Bookmark_where, $limit: Int) {
        Bookmarks(where: $where, limit: $limit) {
          docs {
            ${BOOKMARK_RECORD_FIELDS}
          }
        }
      }
    `,
    {
      variables: {
        where: {
          AND: [
            { contentType: { equals: 'book' } },
            { book: { in: bookIds.map(String) } },
          ],
        },
        limit: bookIds.length,
      },
      authToken,
    }
  );

  return data?.Bookmarks?.docs ?? [];
}

function normalizeIds(ids: number[]): number[] {
  return Array.from(
    new Set(ids.filter((id) => Number.isInteger(id) && id > 0))
  );
}

function buildReadingProgressByChapterId(records: ReadingProgressRecord[]) {
  if (!records.length) {
    return undefined;
  }

  return Object.fromEntries(
    records
      .filter((record) => record.chapterId != null && record.progress != null)
      .map((record) => [Number(record.chapterId!), record.progress!])
  );
}

function emptyBookDetailViewerState(bookId: number): BookDetailViewerState {
  return {
    bookId,
    bookmark: null,
    readingProgress: [],
    continueReadingChapterSlug: null,
    wholeBookProgress: 0,
  };
}

function emptyChapterViewerState(): ChapterViewerState {
  return {
    bookmark: null,
    readingProgress: [],
  };
}
