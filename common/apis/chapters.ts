import type { Book, Chapter, ChapterSlugData, Homepage } from 'types/cms';
import { fetchAPI, fetchAPIWithAuthToken } from './base';
import {
  buildChapterPasswordProofCacheKey,
  normalizeChapterPasswordProofCookieValue,
} from 'common/utils/chapter-password-proof';
import {
  buildChapterPageCacheTags,
  buildChapterPageLookupCacheTags,
  buildChapterSlugCacheTags,
  buildChaptersByBookCacheTags,
  normalizeCacheTags,
} from './cache';
import type { PayloadCacheSettings } from './cache';

interface ChaptersResponse {
  Chapters: {
    docs: Chapter[];
  };
}

interface ChapterDetailResponse {
  Chapters: {
    docs: Chapter[];
  };
  Homepage: Pick<Homepage, 'header'> | null;
}

interface ChapterReaderResponse {
  ChapterMatch: {
    docs: Chapter[];
  };
  ChaptersByBook: {
    docs: Chapter[];
  };
}

interface ChapterPageByBookIdResponse {
  ChapterMatch: {
    docs: Chapter[];
  };
  ChaptersByBook: {
    docs: Chapter[];
  };
  Homepage: Pick<Homepage, 'header'> | null;
}

interface ChaptersProgressMetadataResponse {
  Chapters: {
    docs: Array<{
      id: number;
      chapterWordCount?: number | null;
      book:
        | {
            id: number;
          }
        | number
        | null;
    }>;
  };
}

interface ChapterFetchOptions {
  authToken?: string | null;
  cache?: PayloadCacheSettings;
  chapterPasswordProof?: string | null;
  draftMode?: boolean;
}

function buildChapterStatusFilter(draftMode?: boolean): string {
  if (draftMode) {
    return '{ _status: { in: [published, draft] } }';
  }
  return '{ _status: { equals: published } }';
}

function selectChapterFetcher(options: ChapterFetchOptions) {
  if (options.draftMode) {
    return fetchAPI as typeof fetchAPIWithAuthToken;
  }
  return fetchAPIWithAuthToken;
}

function buildChapterPasswordProofRequestOptions(options: ChapterFetchOptions): {
  cacheKeySuffix?: unknown;
  requestHeaders?: Record<string, string>;
} {
  if (options.authToken) {
    return {};
  }

  const normalizedProof = normalizeChapterPasswordProofCookieValue(options.chapterPasswordProof);

  if (!normalizedProof) {
    return {};
  }

  return {
    cacheKeySuffix: buildChapterPasswordProofCacheKey(normalizedProof),
    requestHeaders: {
      'x-chapter-password-proof': normalizedProof,
    },
  };
}

const CHAPTER_LOOKUP_FIELDS = `
  id
  title
  slug
  hasPassword
`;

const CHAPTER_DETAIL_FIELDS = `
  ${CHAPTER_LOOKUP_FIELDS}
  content
  book {
    ... on Book {
      id
      title
      slug
      origin
      sourceType
      cover {
        url
        optimizedUrl
      }
    }
  }
`;

const CHAPTER_LIST_FIELDS = `
  id
  title
  slug
  order
  hasPassword
  chapterWordCount
`;

const CHAPTER_PAGE_LIST_FIELDS = `
  ${CHAPTER_LIST_FIELDS}
  chapterSourceKey
`;

export async function getChaptersByBookId(
  bookId: number,
  options: ChapterFetchOptions = {}
): Promise<Chapter[]> {
  const fetcher = selectChapterFetcher(options);
  const statusFilter = buildChapterStatusFilter(options.draftMode);

  const data = await fetcher<ChaptersResponse>(
    `#graphql
      query ChaptersByBook($bookRelationId: JSON!) {
        Chapters(
          where: {
            AND: [
              { book: { equals: $bookRelationId } }
              ${statusFilter}
            ]
          }
          sort: "order"
          limit: 200
        ) {
          docs {
            ${CHAPTER_LIST_FIELDS}
          }
        }
      }
    `,
    {
      variables: {
        bookRelationId: bookId,
      },
      getCacheTags: () => buildChaptersByBookCacheTags(bookId),
      authToken: options.authToken,
      cache: options.cache,
    }
  );

  return sortChapters(data?.Chapters?.docs ?? []);
}

export async function getChapterProgressMetadataByBookIds(
  bookIds: number[],
  options: ChapterFetchOptions = {}
): Promise<Record<number, Array<Pick<Chapter, 'id' | 'chapterWordCount'>>>> {
  const uniqueBookIds = [...new Set(bookIds.filter((bookId) => Number.isInteger(bookId) && bookId > 0))];

  if (!uniqueBookIds.length) {
    return {};
  }

  const fetcher = selectChapterFetcher(options);
  const statusFilter = buildChapterStatusFilter(options.draftMode);

  const data = await fetcher<ChaptersProgressMetadataResponse>(
    `#graphql
      query ChaptersProgressMetadataByBooks($bookRelationIds: [JSON]!) {
        Chapters(
          where: {
            AND: [
              { book: { in: $bookRelationIds } }
              ${statusFilter}
            ]
          }
          sort: "order"
          limit: 2000
        ) {
          docs {
            id
            chapterWordCount
            book {
              ... on Book {
                id
              }
            }
          }
        }
      }
    `,
    {
      variables: {
        bookRelationIds: uniqueBookIds,
      },
      authToken: options.authToken,
      cache: options.cache,
    }
  );

  const chaptersByBookId: Record<number, Array<Pick<Chapter, 'id' | 'chapterWordCount'>>> = {};

  for (const chapter of data?.Chapters?.docs ?? []) {
    const resolvedBookId =
      typeof chapter.book === 'number'
        ? chapter.book
        : chapter.book?.id;

    if (!resolvedBookId) {
      continue;
    }

    const entries = chaptersByBookId[resolvedBookId] ?? [];
    entries.push({
      id: chapter.id,
      chapterWordCount: chapter.chapterWordCount ?? null,
    });
    chaptersByBookId[resolvedBookId] = entries;
  }

  return chaptersByBookId;
}

export async function getChapterBySlug(
  chapterSlug: string,
  options: ChapterFetchOptions = {}
): Promise<{ chapter: Chapter | null; homepage: Pick<Homepage, 'header'> | null }> {
  const trimmedSlug = chapterSlug.trim();

  if (!trimmedSlug) {
    return {
      chapter: null,
      homepage: null,
    };
  }

  const fetcher = selectChapterFetcher(options);
  const statusFilter = buildChapterStatusFilter(options.draftMode);

  const data = await fetcher<ChapterDetailResponse>(
    `#graphql
      query ChapterDetailBySlug($chapterSlug: String!) {
        Chapters(
          where: {
            AND: [
              { slug: { equals: $chapterSlug } }
              ${statusFilter}
            ]
          }
          limit: 1
        ) {
          docs {
            ${CHAPTER_DETAIL_FIELDS}
          }
        }

        Homepage {
          header
        }
      }
    `,
    {
      variables: {
        chapterSlug: trimmedSlug,
      },
      getCacheTags: (data) => {
        const chapter = data?.Chapters?.docs?.[0] ?? null;

        return normalizeCacheTags([
          ...buildChapterSlugCacheTags(trimmedSlug),
          ...(chapter?.id != null && chapter?.book && typeof chapter.book === 'object'
            ? buildChapterPageCacheTags((chapter.book as Book).id, chapter.id)
            : []),
        ]);
      },
      authToken: options.authToken,
      cache: options.cache,
      ...buildChapterPasswordProofRequestOptions(options),
    }
  );

  return {
    chapter: data?.Chapters?.docs?.[0] ?? null,
    homepage: data?.Homepage ?? null,
  };
}

export async function getChapterByBookAndSlug(
  bookId: number,
  chapterSlug: string,
  options: ChapterFetchOptions = {}
): Promise<{ chapter: Chapter | null; chapters: Chapter[] }> {
  const trimmedSlug = chapterSlug.trim();

  if (!trimmedSlug) {
    return {
      chapter: null,
      chapters: [],
    };
  }

  const fetcher = selectChapterFetcher(options);
  const statusFilter = buildChapterStatusFilter(options.draftMode);

  const data = await fetcher<ChapterReaderResponse>(
    `#graphql
      query ChapterByBookAndSlug($bookRelationId: JSON!, $chapterSlug: String!) {
        ChapterMatch: Chapters(
          where: {
            AND: [
              { book: { equals: $bookRelationId } }
              { slug: { equals: $chapterSlug } }
              ${statusFilter}
            ]
          }
          limit: 1
        ) {
          docs {
            ${CHAPTER_LOOKUP_FIELDS}
          }
        }

        ChaptersByBook: Chapters(
          where: {
            AND: [
              { book: { equals: $bookRelationId } }
              ${statusFilter}
            ]
          }
          sort: "order"
          limit: 200
        ) {
          docs {
            ${CHAPTER_LIST_FIELDS}
          }
        }
      }
    `,
    {
      variables: {
        bookRelationId: bookId,
        chapterSlug: trimmedSlug,
      },
      getCacheTags: (data) => {
        const chapter = data?.ChapterMatch?.docs?.[0] ?? null;

        return normalizeCacheTags([
          ...buildChapterPageLookupCacheTags(bookId, trimmedSlug),
          ...buildChapterPageCacheTags(bookId, chapter?.id),
        ]);
      },
      authToken: options.authToken,
      cache: options.cache,
    }
  );

  return {
    chapter: data?.ChapterMatch?.docs?.[0] ?? null,
    chapters: sortChapters(data?.ChaptersByBook?.docs ?? []),
  };
}

export async function getChapterPageByBookId(
  bookId: number,
  chapterSlug: string,
  options: ChapterFetchOptions = {}
): Promise<ChapterSlugData> {
  const trimmedSlug = chapterSlug.trim();

  if (!Number.isInteger(bookId) || bookId <= 0 || !trimmedSlug) {
    return {
      book: null,
      chapter: null,
      chapters: [],
      homepage: null,
    };
  }

  const fetcher = selectChapterFetcher(options);
  const statusFilter = buildChapterStatusFilter(options.draftMode);

  const data = await fetcher<ChapterPageByBookIdResponse>(
    `#graphql
      query ChapterDetailWithChaptersByBookId($bookRelationId: JSON!, $chapterSlug: String!) {
        ChapterMatch: Chapters(
          where: {
            AND: [
              { book: { equals: $bookRelationId } }
              { slug: { equals: $chapterSlug } }
              ${statusFilter}
            ]
          }
          limit: 1
        ) {
          docs {
            ${CHAPTER_DETAIL_FIELDS}
          }
        }

        ChaptersByBook: Chapters(
          where: {
            AND: [
              { book: { equals: $bookRelationId } }
              ${statusFilter}
            ]
          }
          sort: "order"
          limit: 200
        ) {
          docs {
            ${CHAPTER_PAGE_LIST_FIELDS}
          }
        }

        Homepage {
          header
        }
      }
    `,
    {
      variables: {
        bookRelationId: bookId,
        chapterSlug: trimmedSlug,
      },
      getCacheTags: (data) => {
        const chapter = data?.ChapterMatch?.docs?.[0] ?? null;

        return normalizeCacheTags([
          ...buildChapterPageLookupCacheTags(bookId, trimmedSlug),
          ...buildChapterPageCacheTags(bookId, chapter?.id),
        ]);
      },
      authToken: options.authToken,
      cache: options.cache,
      ...buildChapterPasswordProofRequestOptions(options),
    }
  );

  const chapter = data?.ChapterMatch?.docs?.[0] ?? null;
  const book = chapter && chapter.book && typeof chapter.book === 'object' ? (chapter.book as Book) : null;

  return {
    book,
    chapter,
    chapters: sortChapters(data?.ChaptersByBook?.docs ?? []),
    homepage: data?.Homepage ?? null,
  };
}

export function sortChapters(chapters: Chapter[]): Chapter[] {
  return [...chapters].sort((first, second) => {
    if (first.order !== second.order) {
      return first.order - second.order;
    }

    const firstCreatedAt = first.createdAt || '';
    const secondCreatedAt = second.createdAt || '';

    if (firstCreatedAt !== secondCreatedAt) {
      return firstCreatedAt.localeCompare(secondCreatedAt);
    }

    return first.id - second.id;
  });
}
