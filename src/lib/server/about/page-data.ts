import 'server-only';

import { cache } from 'react';

import { getDataForAbout } from '@/lib/payload/author';

export const getAboutPageData = cache(getDataForAbout);
