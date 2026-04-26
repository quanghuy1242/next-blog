import React, { useEffect } from 'react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useIntersectionObserver } from 'hooks/useIntersectionObserver';
import { requestBookRouteWarmup } from 'common/utils/book-route-prefetch';

interface SSRPrefetchLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  children: ReactNode;
}

export function SSRPrefetchLink({
  href,
  children,
  onFocus,
  onMouseEnter,
  ...rest
}: SSRPrefetchLinkProps) {
  const { ref, isIntersecting } = useIntersectionObserver<HTMLAnchorElement>({
    enabled: Boolean(href),
    rootMargin: '120px 0px',
    triggerOnce: true,
  });

  useEffect(() => {
    if (!isIntersecting) {
      return;
    }

    requestBookRouteWarmup(href, 'viewport');
  }, [href, isIntersecting]);

  return (
    <Link
      ref={ref}
      href={href}
      prefetch={false}
      onFocus={(event) => {
        onFocus?.(event);
        requestBookRouteWarmup(href, 'hover');
      }}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        requestBookRouteWarmup(href, 'hover');
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
