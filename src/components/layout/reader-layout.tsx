import type { ReactNode } from 'react';

interface ReaderLayoutProps {
  toc: ReactNode;
  children: ReactNode;
}

export function ReaderLayout({ toc, children }: ReaderLayoutProps) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start lg:gap-10">
      {toc}
      <article className="min-w-0 lg:col-span-9 lg:self-start xl:col-span-10">
        <div className="mx-auto max-w-3xl">{children}</div>
      </article>
    </div>
  );
}
