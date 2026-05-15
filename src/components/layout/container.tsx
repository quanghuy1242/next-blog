import type { ReactNode } from 'react';
import cn from 'classnames';

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

export function Container({ children, className = '' }: ContainerProps) {
  return <div className={cn('container px-4', className)}>{children}</div>;
}
