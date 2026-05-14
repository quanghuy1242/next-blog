import { NextRequest } from 'next/server';

import { getAuthTokenFromNextRequest, noStoreJson } from '@/lib/server/http';

export function GET(request: NextRequest) {
  return noStoreJson({
    isAuthenticated: Boolean(getAuthTokenFromNextRequest(request)),
  });
}
