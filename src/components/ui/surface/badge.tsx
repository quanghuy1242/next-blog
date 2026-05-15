import type { HTMLAttributes, ReactNode } from 'react';
import cn from 'classnames';

type BadgeVariant = 'primary' | 'neutral' | 'warning' | 'outline';

export function Badge({
  children,
  variant = 'neutral',
  className,
  ...props
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
} & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      className={cn(
        'badge',
        variant === 'primary' && 'badge-primary',
        variant === 'warning' && 'badge-warning',
        variant === 'outline' && 'badge-outline',
        className
      )}
    >
      {children}
    </span>
  );
}
