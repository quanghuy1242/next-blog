// PayloadCMS GraphQL API Configuration
const PAYLOAD_BASE_URL = process.env.PAYLOAD_BASE_URL;
const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;

const API_URL = PAYLOAD_BASE_URL ? `${PAYLOAD_BASE_URL}/api/graphql` : '';

export interface FetchApiOptions {
  variables?: Record<string, unknown>;
  authToken?: string | null;
  useApiKey?: boolean;
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
  { variables, authToken, useApiKey = true, next }: FetchApiOptions = {}
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
    headers.Authorization = `JWT ${authToken}`;
  } else if (useApiKey && PAYLOAD_API_KEY) {
    headers['Authorization'] = `users API-Key ${PAYLOAD_API_KEY}`;
  }

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
}

export async function fetchAPIWithAuthToken<TData>(
  query: string,
  { variables, authToken, next }: Omit<FetchApiOptions, 'useApiKey'> = {}
): Promise<TData> {
  return fetchAPI<TData>(query, {
    variables,
    authToken,
    useApiKey: false,
    next,
  });
}
