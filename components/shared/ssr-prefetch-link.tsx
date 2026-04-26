import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useIntersectionObserver } from 'hooks/useIntersectionObserver';
import {
  cancelBookRouteWarmup,
  requestBookRouteWarmup,
} from 'common/utils/book-route-prefetch';

const TOUCH_DEVICE_QUERY = '(hover: none), (pointer: coarse)';

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
  const [shouldWarmOnViewport, setShouldWarmOnViewport] = useState(false);
  const hasViewportWarmup = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    setShouldWarmOnViewport(window.matchMedia(TOUCH_DEVICE_QUERY).matches);
  }, []);

  const { ref, isIntersecting } = useIntersectionObserver<HTMLAnchorElement>({
    enabled: Boolean(href) && shouldWarmOnViewport,
    rootMargin: '120px 0px',
    triggerOnce: false,
  });

  useEffect(() => {
    if (!shouldWarmOnViewport) {
      return;
    }

    if (isIntersecting) {
      hasViewportWarmup.current = true;
      requestBookRouteWarmup(href, 'viewport');
    } else if (hasViewportWarmup.current) {
      cancelBookRouteWarmup(href);
      hasViewportWarmup.current = false;
    }

    return () => {
      if (hasViewportWarmup.current) {
        cancelBookRouteWarmup(href);
        hasViewportWarmup.current = false;
      }
    };
  }, [href, isIntersecting, shouldWarmOnViewport]);

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
