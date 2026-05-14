import { Suspense, type ReactNode } from 'react';

import { AppWrapper } from '@/context/state';
import { Analytics } from '@/components/app/analytics';
import { ScrollRestoration } from '@/components/app/scroll-restoration';
import { Header } from '@/components/core/header';

export function Providers({
  children,
  headerText,
}: {
  children: ReactNode;
  headerText?: string | null;
}) {
  return (
    <AppWrapper>
      <Header text={headerText || 'Birdless Sky'} />
      <Suspense fallback={null}>
        <Analytics />
        <ScrollRestoration />
      </Suspense>
      {children}
    </AppWrapper>
  );
}
