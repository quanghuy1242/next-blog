import type { ReactNode } from 'react';
import cn from 'classnames';

interface PanelProps {
  children: ReactNode;
  className?: string;
}

export function Panel({ children, className }: PanelProps) {
  return (
    <section className={cn('rounded-2xl border border-slate-200 bg-white', className)}>
      {children}
    </section>
  );
}

export function CenteredPanel({ children, className }: PanelProps) {
  return (
    <Panel className={cn('mx-auto w-full max-w-xl px-4 py-5 sm:px-6 sm:py-6', className)}>
      {children}
    </Panel>
  );
}
