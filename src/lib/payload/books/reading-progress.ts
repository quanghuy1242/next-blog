import type { ReadingProgressResult } from '@/types/cms';
import { uniquePositiveIntegers } from '@/lib/shared/number';
import { fetchAPIWithAuthToken } from '../core/client';

const SAVE_READING_PROGRESS_MUTATION = `#graphql
  mutation SaveReadingProgress($chapterId: ID!, $bookId: ID!, $progress: Float!) {
    saveReadingProgress(chapterId: $chapterId, bookId: $bookId, progress: $progress) {
      ok
      progress {
        id
        progress
        completedAt
        updatedAt
      }
    }
  }
`;

type ReadingProgressRecords = ReadingProgressResult['records'];

type ReadingProgressByBookIdResponse = Record<
  string,
  ReadingProgressResult | null | undefined
>;

interface SaveReadingProgressResponse {
  saveReadingProgress: {
    ok: boolean;
    progress: {
      id: string;
      progress: number;
      completedAt: string | null;
      updatedAt: string | null;
    } | null;
  } | null;
}

export async function getReadingProgressByBookIds(
  bookIds: number[],
  options: { authToken?: string | null } = {}
): Promise<Map<number, ReadingProgressRecords>> {
  const uniqueBookIds = uniquePositiveIntegers(bookIds);

  if (!options.authToken || uniqueBookIds.length === 0) {
    return new Map();
  }

  const variableDefinitions = uniqueBookIds
    .map((_, index) => `$bookId${index}: ID!`)
    .join(', ');
  const queryFields = uniqueBookIds
    .map(
      (_, index) => `
        book${index}: readingProgress(bookId: $bookId${index}) {
          records {
            chapterId
            progress
            completedAt
            updatedAt
          }
        }
      `
    )
    .join('\n');
  const variables = Object.fromEntries(
    uniqueBookIds.map((bookId, index) => [`bookId${index}`, String(bookId)])
  );

  const data = await fetchAPIWithAuthToken<ReadingProgressByBookIdResponse>(
    `#graphql
      query ReadingProgressByBookIds(${variableDefinitions}) {
        ${queryFields}
      }
    `,
    {
      variables,
      authToken: options.authToken,
    }
  );

  return new Map(
    uniqueBookIds.map((bookId, index) => [
      bookId,
      data?.[`book${index}`]?.records ?? [],
    ])
  );
}

export async function saveReadingProgress(
  chapterId: string,
  bookId: string,
  progress: number,
  options: { authToken?: string | null }
): Promise<{ ok: boolean }> {
  if (!options.authToken) {
    throw new Error('Authentication required.');
  }

  const data = await fetchAPIWithAuthToken<SaveReadingProgressResponse>(
    SAVE_READING_PROGRESS_MUTATION,
    {
      variables: { chapterId, bookId, progress },
      authToken: options.authToken,
    }
  );

  return { ok: data?.saveReadingProgress?.ok ?? false };
}
