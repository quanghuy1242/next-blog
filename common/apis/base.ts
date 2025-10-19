const API_URL = 'https://graphql.datocms.com';
const API_TOKEN = process.env.NEXT_EXAMPLE_CMS_DATOCMS_API_TOKEN;

// See: https://www.datocms.com/blog/offer-responsive-progressive-lqip-images-in-2020
export const responsiveImageFragment = `#graphql
  fragment responsiveImageFragment on ResponsiveImage {
  srcSet
    webpSrcSet
    sizes
    src
    width
    height
    aspectRatio
    alt
    title
    bgColor
    base64
  }
`;

export interface FetchApiOptions {
  variables?: Record<string, unknown>;
  preview?: boolean;
  next?: {
    revalidate?: number;
    tags?: string[];
  };
}

interface DatocmsResponse<TData> {
  data: TData;
  errors?: Array<{ message?: string }>;
}

// Rework this with useSWR
export async function fetchAPI<TData>(
  query: string,
  { variables, preview, next }: FetchApiOptions = {}
): Promise<TData> {
  if (!API_TOKEN) {
    console.warn(
      'NEXT_EXAMPLE_CMS_DATOCMS_API_TOKEN is not set. Returning empty response.'
    );
    return {} as TData;
  }

  const res = await fetch(API_URL + (preview ? '/preview' : ''), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
    next,
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch API. Status: ${res.status}`);
  }

  const json = (await res.json()) as DatocmsResponse<TData>;

  if (json.errors) {
    console.error(json.errors);
    throw new Error('Failed to fetch API');
  }

  return json.data;
}
