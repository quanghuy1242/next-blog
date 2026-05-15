import 'server-only';

import { cache } from 'react';

import { getDataForAbout } from '@/lib/payload/author/profile';

export const getAboutPageData = cache(getDataForAbout);
