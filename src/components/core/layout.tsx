import type { ReactNode } from 'react';
import cn from 'classnames';

import { PageChrome } from './page-chrome';
import { DraftBanner } from '@/components/shared/draft-banner';

interface LayoutProps {
  children: ReactNode;
  className?: string;
  header?: string | null;
  isAuthenticated?: boolean;
  isDraftMode?: boolean;
  draftExitHref?: string;
}

export function Layout({
  children,
  className,
  header,
  isAuthenticated,
  isDraftMode,
  draftExitHref,
}: LayoutProps) {
  return (
    <>
      <main>
        <PageChrome header={header} isAuthenticated={isAuthenticated} />
        {isDraftMode ? <DraftBanner exitHref={draftExitHref} /> : null}
        <div className="mt-16" />
        <div className={cn(className)}>{children}</div>
      </main>
    </>
  );
}
