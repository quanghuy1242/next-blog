import {
  buildPayloadCacheKey,
  readThroughCloudflareCache,
  type PayloadCacheSettings,
} from './cache';
import { getAuthCacheSubjectFromToken } from 'common/utils/auth';

// PayloadCMS GraphQL API Configuration
const PAYLOAD_BASE_URL = process.env.PAYLOAD_BASE_URL;
const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;

const API_URL = PAYLOAD_BASE_URL ? `${PAYLOAD_BASE_URL}/api/graphql` : '';

export interface FetchApiOptions<TData = unknown> {
  variables?: Record<string, unknown>;
  authToken?: string | null;
  useApiKey?: boolean;
  cache?: PayloadCacheSettings;
  getCacheTags?: (data: TData) => string[] | null | undefined;
  next?: {
    revalidate?: number;
    tags?: string[];
  };
}

interface PayloadCMSResponse<TData> {
  data: TData;
  errors?: Array<{ message?: string }>;
}

/**
 * Fetch data from PayloadCMS GraphQL API
 */
export async function fetchAPI<TData>(
  query: string,
  { variables, authToken, useApiKey = true, cache, getCacheTags, next }: FetchApiOptions<TData> = {}
): Promise<TData> {
  if (!PAYLOAD_BASE_URL) {
    console.warn('PAYLOAD_BASE_URL is not set. Returning empty response.');
    return {} as TData;
  }

  if (useApiKey && !PAYLOAD_API_KEY) {
    console.warn('PAYLOAD_API_KEY is not set. Authentication may fail.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  } else if (useApiKey && PAYLOAD_API_KEY) {
    headers['Authorization'] = `users API-Key ${PAYLOAD_API_KEY}`;
  }

  const fetchFresh = async (): Promise<TData> => {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        variables,
      }),
      next,
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch API. Status: ${res.status}`);
    }

    const json = (await res.json()) as PayloadCMSResponse<TData>;

    if (json.errors) {
      console.error(json.errors);
      throw new Error('Failed to fetch API');
    }

    return json.data;
  };

  const authCacheSubject =
    authToken && cache ? getAuthCacheSubjectFromToken(authToken) : null;

  if (authToken && cache && !authCacheSubject) {
    return fetchFresh();
  }

  if (!cache) {
    return fetchFresh();
  }

  const cacheFingerprint = authCacheSubject
    ? {
        authSubject: authCacheSubject,
        query,
        variables,
      }
    : {
        query,
        useApiKey,
        variables,
      };

  const cacheKey = buildPayloadCacheKey(API_URL, {
    ...cacheFingerprint,
  });

  return readThroughCloudflareCache({
    cacheKey,
    fetchFresh,
    getCacheTags,
    settings: cache,
  });
}

export async function fetchAPIWithAuthToken<TData>(
  query: string,
  {
    variables,
    authToken,
    cache,
    getCacheTags,
    next,
  }: Omit<FetchApiOptions<TData>, 'useApiKey'> = {}
): Promise<TData> {
  return fetchAPI<TData>(query, {
    variables,
    authToken,
    useApiKey: false,
    cache,
    getCacheTags,
    next,
  });
}
