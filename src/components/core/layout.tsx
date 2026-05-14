import { Suspense, type ReactNode } from 'react';
import { Header } from './header';
import { DraftBanner } from '@/components/shared/draft-banner';
import cn from 'classnames';

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
        {isDraftMode ? <DraftBanner exitHref={draftExitHref} /> : null}
        <Suspense fallback={null}>
          <Header text={header} isAuthenticated={isAuthenticated} />
        </Suspense>
        <div className="mt-16" />
        <div className={cn(className)}>{children}</div>
      </main>
    </>
  );
}
