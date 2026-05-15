import type { ReactNode } from 'react';
import cn from 'classnames';

import { Container } from './container';
import { ContentColumn } from './content-column';

type PageSectionWidth = 'full' | 'content' | 'article' | 'wide' | 'narrow';

interface PageSectionProps {
  children: ReactNode;
  width?: PageSectionWidth;
  className?: string;
  innerClassName?: string;
}

export function PageSection({
  children,
  width = 'full',
  className,
  innerClassName,
}: PageSectionProps) {
  const content = width === 'full'
    ? children
    : (
      <ContentColumn
        width={width === 'content' ? 'content' : width}
        className={innerClassName}
      >
        {children}
      </ContentColumn>
    );

  return (
    <Container className={cn('my-4 w-full md:px-20', className)}>
      {content}
    </Container>
  );
}
