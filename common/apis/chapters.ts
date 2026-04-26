import type { Book, Chapter, ChapterSlugData, Homepage } from 'types/cms';
import { fetchAPIWithAuthToken } from './base';
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

interface ChapterFetchOptions {
  authToken?: string | null;
  cache?: PayloadCacheSettings;
}

const CHAPTER_MATCH_FIELDS = `
  id
  title
  slug
  order
  chapterWordCount
  hasPassword
  chapterSourceKey
  chapterSourceHash
  importBatchId
  manualEditedAt
  content
  updatedAt
  createdAt
  _status
`;

const CHAPTER_DETAIL_FIELDS = `
  ${CHAPTER_MATCH_FIELDS}
  book {
    ... on Book {
      id
      title
      slug
      author
      description
      language
      visibility
      chapterCount
      totalWordCount
      cover {
        id
        url
        alt
        width
        height
      }
    }
  }
`;

const CHAPTER_LIST_FIELDS = `
  id
  title
  slug
  order
  chapterWordCount
  hasPassword
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
            ${CHAPTER_LIST_FIELDS}
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

  const data = await fetchAPIWithAuthToken<ChapterDetailResponse>(
    `#graphql
      query ChapterDetailBySlug($chapterSlug: String!) {
        Chapters(
          where: {
            AND: [
              { slug: { equals: $chapterSlug } }
              { _status: { equals: published } }
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
      authToken: options.authToken,
      cache: options.cache,
    }
  );

  return {
    chapter: data?.Chapters?.docs?.[0] ?? null,
    homepage: data?.Homepage ?? null,
  };
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
            ${CHAPTER_MATCH_FIELDS}
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
            ${CHAPTER_LIST_FIELDS}
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

export async function getChapterPageByBookId(
  bookID: number,
  chapterSlug: string,
  options: ChapterFetchOptions = {}
): Promise<ChapterSlugData> {
  const trimmedSlug = chapterSlug.trim();

  if (!Number.isInteger(bookID) || bookID <= 0 || !trimmedSlug) {
    return {
      book: null,
      chapter: null,
      chapters: [],
      homepage: null,
    };
  }

  const data = await fetchAPIWithAuthToken<ChapterPageByBookIdResponse>(
    `#graphql
      query ChapterDetailWithChaptersByBookId($bookID: JSON!, $chapterSlug: String!) {
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
            ${CHAPTER_DETAIL_FIELDS}
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
            ${CHAPTER_LIST_FIELDS}
          }
        }

        Homepage {
          header
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
