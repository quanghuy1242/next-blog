import 'server-only';

import { cache } from 'react';

import { ONE_HOUR_PAYLOAD_CACHE } from '@/lib/payload/cache';
import { getHomePageShell } from '@/lib/payload/home-page-shell';

export const getCategoriesPageData = cache(() =>
  getHomePageShell({
    cache: ONE_HOUR_PAYLOAD_CACHE,
  })
);
