import { Suspense, type ReactNode } from 'react';

import { Analytics } from '@/components/core/effects/analytics';
import { ScrollRestoration } from '@/components/core/effects/scroll-restoration';
import { AppHeader } from '@/components/core/app-header';
import { AriaProvider } from './aria-provider';

export function Providers({
  children,
  headerText,
}: {
  children: ReactNode;
  headerText?: string | null;
}) {
  return (
    <AriaProvider>
      <AppHeader text={headerText || 'Birdless Sky'} />
      <Suspense fallback={null}>
        <Analytics />
        <ScrollRestoration />
      </Suspense>
      {children}
    </AriaProvider>
  );
}
