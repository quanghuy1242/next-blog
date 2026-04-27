import React from 'react';
import cn from 'classnames';

interface ChapterLockBadgeProps {
  className?: string;
}

export function ChapterLockBadge({ className }: ChapterLockBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border border-blue/20 bg-blue/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue',
        className
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="h-3 w-3"
      >
        <rect
          x="4.25"
          y="8.25"
          width="11.5"
          height="8"
          rx="1.75"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M6.5 8.25V6.75a3.5 3.5 0 0 1 7 0v1.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M10 11.5v1.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <span>Locked</span>
    </span>
  );
}
