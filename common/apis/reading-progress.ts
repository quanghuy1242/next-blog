import type { ReadingProgressResult } from 'types/cms';
import { fetchAPIWithAuthToken } from './base';

const READING_PROGRESS_QUERY = `#graphql
  query ReadingProgress($bookId: ID!) {
    readingProgress(bookId: $bookId) {
      records {
        chapterId
        progress
        completedAt
        updatedAt
      }
    }
  }
`;

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

interface ReadingProgressResponse {
  readingProgress: ReadingProgressResult | null;
}

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

export async function getReadingProgress(
  bookId: string,
  options: { authToken?: string | null } = {}
): Promise<ReadingProgressResult['records']> {
  if (!options.authToken) {
    return [];
  }

  const data = await fetchAPIWithAuthToken<ReadingProgressResponse>(
    READING_PROGRESS_QUERY,
    {
      variables: { bookId },
      authToken: options.authToken,
    }
  );

  return data?.readingProgress?.records ?? [];
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
