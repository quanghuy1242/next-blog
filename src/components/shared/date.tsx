import React from 'react';
import { formatDate } from '@/lib/utils/date';

interface DateProps {
  dateString: string;
  className?: string;
}

export function Date({ dateString, className }: DateProps) {
  return (
    <time dateTime={dateString} className={className} suppressHydrationWarning>
      {formatDate(dateString)}
    </time>
  );
}
