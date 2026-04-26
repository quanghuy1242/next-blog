import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useIntersectionObserver } from 'hooks/useIntersectionObserver';
import { usePointerProximityObserver } from 'hooks/usePointerProximityObserver';
import {
  cancelBookRouteWarmup,
  requestBookRouteWarmup,
} from 'common/utils/book-route-prefetch';

const TOUCH_DEVICE_QUERY = '(hover: none), (pointer: coarse)';
const DESKTOP_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

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
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const [shouldWarmOnViewport] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia(TOUCH_DEVICE_QUERY).matches;
  });
  const [shouldWarmOnPointer] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    const isTouchDevice = window.matchMedia(TOUCH_DEVICE_QUERY).matches;

    return !isTouchDevice && window.matchMedia(DESKTOP_POINTER_QUERY).matches;
  });
  const hasViewportWarmup = useRef(false);
  const hasPointerWarmup = useRef(false);

  const { isIntersecting } = useIntersectionObserver<HTMLAnchorElement>({
    enabled: Boolean(href) && shouldWarmOnViewport,
    rootMargin: '120px 0px',
    targetRef: anchorRef,
    triggerOnce: false,
  });

  const { isProximate } = usePointerProximityObserver<HTMLAnchorElement>({
    enabled: Boolean(href) && shouldWarmOnPointer,
    targetRef: anchorRef,
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

  useEffect(() => {
    if (!shouldWarmOnPointer) {
      return;
    }

    if (isProximate) {
      hasPointerWarmup.current = true;
      requestBookRouteWarmup(href, 'pointer');
    } else if (hasPointerWarmup.current) {
      cancelBookRouteWarmup(href);
      hasPointerWarmup.current = false;
    }

    return () => {
      if (hasPointerWarmup.current) {
        cancelBookRouteWarmup(href);
        hasPointerWarmup.current = false;
      }
    };
  }, [href, isProximate, shouldWarmOnPointer]);

  return (
    <Link
      ref={anchorRef}
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
