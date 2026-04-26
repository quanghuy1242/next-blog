import type { Chapter } from 'types/cms';
import { fetchAPIWithAuthToken } from './base';
import type { PayloadCacheSettings } from './cache';

interface ChaptersResponse {
  Chapters: {
    docs: Chapter[];
  };
}

interface ChapterReaderResponse {
  ChapterMatch: {
    docs: Chapter[];
  };
  ChaptersByBook: {
    docs: Chapter[];
  };
}

interface ChapterFetchOptions {
  authToken?: string | null;
  cache?: PayloadCacheSettings;
}

const CHAPTER_FIELDS = `
  id
  title
  slug
  order
  chapterSourceKey
  chapterSourceHash
  importBatchId
  manualEditedAt
  content
  updatedAt
  createdAt
  _status
`;

const CHAPTER_TOC_FIELDS = `
  id
  title
  slug
  order
  chapterSourceKey
  updatedAt
  createdAt
  _status
`;

export async function getChaptersByBookId(
  bookID: number,
  options: ChapterFetchOptions = {}
): Promise<Chapter[]> {
  const data = await fetchAPIWithAuthToken<ChaptersResponse>(
    `#graphql
      query ChaptersByBook($bookID: JSON!) {
        Chapters(
          where: {
            AND: [
              { book: { equals: $bookID } }
              { _status: { equals: published } }
            ]
          }
          sort: "order"
          limit: 200
        ) {
          docs {
            ${CHAPTER_FIELDS}
          }
        }
      }
    `,
    {
      variables: {
        bookID,
      },
      authToken: options.authToken,
      cache: options.cache,
    }
  );

  return sortChapters(data?.Chapters?.docs ?? []);
}

export async function getChapterByBookAndSlug(
  bookID: number,
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

  const data = await fetchAPIWithAuthToken<ChapterReaderResponse>(
    `#graphql
      query ChapterByBookAndSlug($bookID: JSON!, $chapterSlug: String!) {
        ChapterMatch: Chapters(
          where: {
            AND: [
              { book: { equals: $bookID } }
              { slug: { equals: $chapterSlug } }
              { _status: { equals: published } }
            ]
          }
          limit: 1
        ) {
          docs {
            ${CHAPTER_FIELDS}
          }
        }

        ChaptersByBook: Chapters(
          where: {
            AND: [
              { book: { equals: $bookID } }
              { _status: { equals: published } }
            ]
          }
          sort: "order"
          limit: 200
        ) {
          docs {
            ${CHAPTER_TOC_FIELDS}
          }
        }
      }
    `,
    {
      variables: {
        bookID,
        chapterSlug: trimmedSlug,
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
