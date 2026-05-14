import type { ReactNode } from 'react';
import cn from 'classnames';

import { DraftBanner } from '@/components/shared/draft-banner';

interface LayoutProps {
  children: ReactNode;
  className?: string;
  isDraftMode?: boolean;
  draftExitHref?: string;
}

export function Layout({
  children,
  className,
  isDraftMode,
  draftExitHref,
}: LayoutProps) {
  return (
    <>
      <main>
        {isDraftMode ? <DraftBanner exitHref={draftExitHref} /> : null}
        <div className="mt-16" />
        <div className={cn(className)}>{children}</div>
      </main>
    </>
  );
}
