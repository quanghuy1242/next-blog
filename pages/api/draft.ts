import type { NextApiRequest, NextApiResponse } from 'next';
import { validatePreviewToken } from 'common/utils/preview';

function isSafeRedirectPath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';

  if (!token) {
    res.status(400).json({ error: 'Missing token parameter.' });
    return;
  }

  const validationResult = validatePreviewToken(token);

  if (!validationResult.ok) {
    const statusCode =
      validationResult.reason === 'invalid-signature' ||
      validationResult.reason === 'expired' ||
      validationResult.reason === 'missing-secret'
        ? 401
        : 400;
    const errorMessage =
      validationResult.reason === 'expired'
        ? 'Preview token has expired.'
        : validationResult.reason === 'invalid-signature'
          ? 'Invalid preview token signature.'
          : validationResult.reason === 'missing-secret'
            ? 'Preview mode is not configured.'
            : 'Malformed preview token.';

    res.status(statusCode).json({ error: errorMessage });
    return;
  }

  const redirect = typeof req.query.redirect === 'string' ? req.query.redirect.trim() : '';

  if (!redirect || !isSafeRedirectPath(redirect)) {
    res.status(400).json({ error: 'Invalid redirect path.' });
    return;
  }

  res.setDraftMode({ enable: true });
  res.writeHead(307, { Location: redirect });
  res.end();
}
