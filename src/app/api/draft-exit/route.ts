import { draftMode } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { methodNotAllowed } from '@/lib/server/http';

export async function GET(request: NextRequest) {
  const preview = await draftMode();
  preview.disable();

  return NextResponse.redirect(new URL('/', request.url), {
    status: 307,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

export function POST() {
  return methodNotAllowed(['GET']);
}
