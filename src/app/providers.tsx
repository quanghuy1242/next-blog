import { Suspense, type ReactNode } from 'react';

import { AppWrapper } from '@/context/state';
import { Analytics } from '@/components/app/analytics';
import { ScrollRestoration } from '@/components/app/scroll-restoration';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppWrapper>
      <Suspense fallback={null}>
        <Analytics />
        <ScrollRestoration />
      </Suspense>
      {children}
    </AppWrapper>
  );
}
