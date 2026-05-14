import { NextRequest } from 'next/server';

import { deleteBookmark } from '@/lib/payload/bookmarks';
import { getAuthTokenFromNextRequest, methodNotAllowed, noStoreJson } from '@/lib/server/http';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ bookmarkId: string }> }
) {
  const sessionToken = getAuthTokenFromNextRequest(request);

  if (!sessionToken) {
    return noStoreJson({ error: 'Authentication required.' }, { status: 401 });
  }

  const { bookmarkId } = await params;
  const id = bookmarkId?.trim();

  if (!id) {
    return noStoreJson({ error: 'bookmarkId is required.' }, { status: 400 });
  }

  try {
    const result = await deleteBookmark(id, { authToken: sessionToken });
    return noStoreJson(result);
  } catch (error) {
    console.error('Failed to delete bookmark', error);
    return noStoreJson({ error: 'Failed to delete bookmark.' }, { status: 500 });
  }
}

export function GET() {
  return methodNotAllowed(['DELETE']);
}
