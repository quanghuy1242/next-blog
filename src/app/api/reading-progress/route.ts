import { NextRequest } from 'next/server';

import { saveReadingProgress } from '@/lib/payload/reading-progress';
import {
  getAuthTokenFromNextRequest,
  methodNotAllowed,
  noStoreJson,
  parseJsonBody,
} from '@/lib/server/http';

export async function POST(request: NextRequest) {
  const sessionToken = getAuthTokenFromNextRequest(request);

  if (!sessionToken) {
    return noStoreJson({ error: 'Authentication required.' }, { status: 401 });
  }

  const body = await parseJsonBody<Record<string, unknown>>(request);

  if (!body) {
    return noStoreJson({ error: 'Invalid request body.' }, { status: 400 });
  }

  const chapterId =
    typeof body.chapterId === 'number' || typeof body.chapterId === 'string'
      ? String(body.chapterId)
      : '';
  const bookId =
    typeof body.bookId === 'number' || typeof body.bookId === 'string'
      ? String(body.bookId)
      : '';
  const progress = typeof body.progress === 'number' ? body.progress : Number.NaN;

  if (!chapterId || !bookId) {
    return noStoreJson({ error: 'chapterId and bookId are required.' }, { status: 400 });
  }

  if (Number.isNaN(progress) || progress < 0 || progress > 100) {
    return noStoreJson(
      { error: 'progress must be a number between 0 and 100.' },
      { status: 400 }
    );
  }

  try {
    const result = await saveReadingProgress(chapterId, bookId, progress, {
      authToken: sessionToken,
    });

    if (!result.ok) {
      return noStoreJson({ error: 'Chapter or book was not found.' }, { status: 404 });
    }

    return noStoreJson({ ok: true });
  } catch (error) {
    console.error('Failed to save reading progress', error);
    return noStoreJson({ error: 'Failed to save reading progress.' }, { status: 500 });
  }
}

export function GET() {
  return methodNotAllowed(['POST']);
}
