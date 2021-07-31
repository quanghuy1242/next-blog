import cn from 'classnames';

export function Container({ children, className = '' }) {
  return <div className={cn('container px-4', className)}>{children}</div>;
}
