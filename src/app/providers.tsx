import { Suspense, type ReactNode } from 'react';

import { AppWrapper } from '@/context/state';
import { Analytics } from '@/components/app/analytics';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppWrapper>
      <Suspense fallback={null}>
        <Analytics />
      </Suspense>
      {children}
    </AppWrapper>
  );
}
