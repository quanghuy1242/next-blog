import type { ReactNode } from 'react';
import cn from 'classnames';

interface FeedLayoutProps {
  main: ReactNode;
  sidebar: ReactNode;
  mobileRail?: ReactNode;
  className?: string;
}

export function FeedLayout({
  main,
  sidebar,
  mobileRail,
  className,
}: FeedLayoutProps) {
  return (
    <div className={cn(className)}>
      {mobileRail ? <div className="mb-4 md:hidden">{mobileRail}</div> : null}
      <div className="flex flex-col md:flex-row">
        <div className="flex-grow md:mr-6 md:w-2/3">{main}</div>
        <aside className="hidden md:block md:w-1/3">{sidebar}</aside>
      </div>
    </div>
  );
}
