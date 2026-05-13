import type { ReactNode } from 'react';
import cn from 'classnames';

interface InputClassNameOptions {
  hasError?: boolean;
  className?: string;
}

export function getInputClassName({
  hasError = false,
  className,
}: InputClassNameOptions = {}) {
  return cn(
    'w-full rounded border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition disabled:opacity-50',
    hasError
      ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
      : 'border-gray-300 focus:border-blue focus:ring-1 focus:ring-blue',
    className
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) {
    return null;
  }

  return (
    <p className="text-sm text-red-600" role="alert">
      {children}
    </p>
  );
}
