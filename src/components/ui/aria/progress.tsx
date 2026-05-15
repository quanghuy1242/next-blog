'use client';

import cn from 'classnames';
import {
  ProgressBar as AriaProgressBar,
  type ProgressBarProps as AriaProgressBarProps,
} from 'react-aria-components/ProgressBar';

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <span
      className={cn('loading loading-spinner loading-md text-primary', className)}
      aria-hidden
    />
  );
}

export function ProgressBar({
  className,
  ...props
}: AriaProgressBarProps & { className?: string }) {
  return (
    <AriaProgressBar {...props} className={cn('w-full', className)}>
      {({ percentage }) => (
        <progress
          className="progress progress-primary w-full"
          value={percentage ?? 0}
          max={100}
        />
      )}
    </AriaProgressBar>
  );
}
