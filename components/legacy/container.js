import cn from 'classnames';

export default function Container({ children, className = '' }) {
  return (
    <div className={cn('container mx-auto px-5', className)}>{children}</div>
  );
}
