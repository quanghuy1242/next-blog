import type { ReactNode } from 'react';
import cn from 'classnames';

type ContentColumnWidth = 'content' | 'article' | 'wide' | 'narrow';

const widthClasses: Record<ContentColumnWidth, string> = {
  content: 'mx-auto w-full md:w-2/3',
  article: 'mx-auto w-full max-w-3xl',
  wide: 'mx-auto w-full max-w-4xl',
  narrow: 'mx-auto w-full max-w-2xl',
};

interface ContentColumnProps {
  children: ReactNode;
  width?: ContentColumnWidth;
  className?: string;
}

export function ContentColumn({
  children,
  width = 'content',
  className,
}: ContentColumnProps) {
  return <div className={cn(widthClasses[width], className)}>{children}</div>;
}
