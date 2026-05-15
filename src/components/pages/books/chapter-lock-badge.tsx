import React from 'react';
import cn from 'classnames';
import { Lock } from 'lucide-react';
import { Badge } from '@/components/ui/surface/badge';

interface ChapterLockBadgeProps {
  className?: string;
  compact?: boolean;
}

export function ChapterLockBadge({ className, compact = false }: ChapterLockBadgeProps) {
  const icon = <Lock aria-hidden className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />;

  if (compact) {
    return (
      <Badge
        variant="primary"
        className={cn(
          'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full p-0',
          className
        )}
      >
        {icon}
        <span className="sr-only">Locked</span>
      </Badge>
    );
  }

  return (
    <Badge
      variant="primary"
      className={cn(
        'inline-flex shrink-0 items-center gap-1 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em]',
        className
      )}
    >
      {icon}
      <span>Locked</span>
    </Badge>
  );
}
