import type { ReactNode } from 'react';
import cn from 'classnames';

interface CardProps {
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: 'article' | 'div' | 'section';
}

export function Card({
  children,
  className,
  bodyClassName,
  as: Component = 'div',
}: CardProps) {
  return (
    <Component className={cn('card border border-base-300 bg-base-100', className)}>
      <div className={cn('card-body', bodyClassName)}>{children}</div>
    </Component>
  );
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('card border border-base-300 bg-base-100', className)}>
      {children}
    </section>
  );
}

export function CenteredPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Panel className={cn('mx-auto w-full max-w-xl px-4 py-5 sm:px-6 sm:py-6', className)}>
      {children}
    </Panel>
  );
}
