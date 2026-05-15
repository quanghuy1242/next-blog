import 'server-only';

import { ONE_HOUR_PAYLOAD_CACHE } from '@/lib/payload/core/cache';
import { getHomepageHeader } from '@/lib/payload/home/shell';

export function getRootLayoutData() {
  return getHomepageHeader({ cache: ONE_HOUR_PAYLOAD_CACHE });
}
