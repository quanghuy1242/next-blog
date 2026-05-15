import type { ReactNode } from 'react';
import cn from 'classnames';

import { DraftBanner } from '@/components/shared/draft-banner';

interface PageShellProps {
  children: ReactNode;
  className?: string;
  isDraftMode?: boolean;
  draftExitHref?: string;
}

export function PageShell({
  children,
  className,
  isDraftMode,
  draftExitHref,
}: PageShellProps) {
  return (
    <main>
      {isDraftMode ? <DraftBanner exitHref={draftExitHref} /> : null}
      <div className="mt-16" />
      <div className={cn(className)}>{children}</div>
    </main>
  );
}
