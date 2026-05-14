import { draftMode } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { methodNotAllowed, noStoreJson } from '@/lib/server/http';
import { validatePreviewToken } from '@/lib/preview/preview';

function isSafeRedirectPath(value: string) {
  return value.startsWith('/') && !value.startsWith('//');
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim() || '';

  if (!token) {
    return noStoreJson({ error: 'Missing token parameter.' }, { status: 400 });
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

    return noStoreJson({ error: errorMessage }, { status: statusCode });
  }

  const redirect = request.nextUrl.searchParams.get('redirect')?.trim() || '';

  if (!redirect || !isSafeRedirectPath(redirect)) {
    return noStoreJson({ error: 'Invalid redirect path.' }, { status: 400 });
  }

  const preview = await draftMode();
  preview.enable();

  return NextResponse.redirect(new URL(redirect, request.url), {
    status: 307,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

export function POST() {
  return methodNotAllowed(['GET']);
}
