'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import * as gtag from '@/lib/integrations/analytics/gtag';

export function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const search = searchParams?.toString();
    const url = `${pathname || '/'}${search ? `?${search}` : ''}`;

    gtag.pageview(url);
  }, [pathname, searchParams]);

  return null;
}
