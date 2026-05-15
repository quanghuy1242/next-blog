'use client';

import type { ReactNode } from 'react';
import { I18nProvider } from 'react-aria-components/I18nProvider';

export function AriaProvider({ children }: { children: ReactNode }) {
  return <I18nProvider locale="en-US">{children}</I18nProvider>;
}
