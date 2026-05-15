import 'server-only';

import { cache } from 'react';

import { getDataForPostSlug } from '@/lib/payload/posts/detail';

export const getPostPageData = cache((slug: string, isDraftMode: boolean) =>
  getDataForPostSlug(slug, { draftMode: isDraftMode })
);
