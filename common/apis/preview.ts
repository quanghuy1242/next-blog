import { fetchAPI } from './base';
import type { PreviewTokenResult } from 'types/cms';

const PREVIEW_TOKEN_QUERY = `#graphql
  query PreviewToken($docType: String!, $docId: ID!) {
    previewToken(docType: $docType, docId: $docId) {
      token
      slug
    }
  }
`;

export async function getPreviewToken(
  docType: string,
  docId: string
): Promise<PreviewTokenResult | null> {
  const data = await fetchAPI<{ previewToken: PreviewTokenResult | null }>(
    PREVIEW_TOKEN_QUERY,
    {
      variables: { docType, docId },
      useApiKey: true,
    }
  );

  return data?.previewToken ?? null;
}