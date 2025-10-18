import type { ReactNode } from 'react';
import { Metadata } from './metadata';
import { Header } from './header';
import cn from 'classnames';

interface LayoutProps {
  children: ReactNode;
  className?: string;
  header?: string | null;
}

export function Layout({ children, className, header }: LayoutProps) {
  return (
    <>
      <Metadata />
      <main>
        <Header text={header} />
        <div className="mt-16" />
        <div className={cn(className)}>{children}</div>
      </main>
    </>
  );
}
