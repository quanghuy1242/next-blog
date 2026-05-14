import cn from 'classnames';

interface LoadingSpinnerProps {
  className?: string;
}

export function LoadingSpinner({ className }: LoadingSpinnerProps) {
  return (
    <span
      className={cn(
        'h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700',
        className
      )}
      aria-hidden
    />
  );
}
