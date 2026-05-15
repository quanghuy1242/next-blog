import type { ReactNode } from 'react';
import cn from 'classnames';

type StatusVariant = 'neutral' | 'error' | 'warning' | 'success';

export function StatusText({
  children,
  variant = 'neutral',
  className,
}: {
  children: ReactNode;
  variant?: StatusVariant;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'text-sm',
        variant === 'neutral' && 'text-base-content/60',
        variant === 'error' && 'text-error',
        variant === 'warning' && 'text-warning',
        variant === 'success' && 'text-success',
        className
      )}
    >
      {children}
    </p>
  );
}

export function Alert({
  children,
  variant = 'neutral',
  className,
}: {
  children: ReactNode;
  variant?: StatusVariant;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'alert',
        variant === 'error' && 'alert-error',
        variant === 'warning' && 'alert-warning',
        variant === 'success' && 'alert-success',
        variant === 'neutral' && 'border-base-300 bg-base-100',
        className
      )}
    >
      {children}
    </div>
  );
}
