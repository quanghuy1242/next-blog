import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useIntersectionObserver } from 'hooks/useIntersectionObserver';
import { usePointerProximityObserver } from 'hooks/usePointerProximityObserver';
import {
  claimBookRouteWarmup,
  cancelBookRouteWarmup,
  requestBookRouteWarmup,
} from 'common/utils/book-route-prefetch';

const TOUCH_DEVICE_QUERY = '(hover: none), (pointer: coarse)';
const DESKTOP_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

/**
 * Props for the book/chapter link wrapper that coordinates UI intent with the
 * warmup scheduler.
 *
 * `onNavigate` is modeled after Next's `Link` callback instead of the browser
 * click event because this component needs to distinguish "a real client-side
 * navigation will happen now" from other clicks such as modified clicks, new
 * tab opens, or clicks that were already prevented upstream.
 */
interface SSRPrefetchLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  children: ReactNode;
  onNavigate?: (event: { preventDefault: () => void }) => void;
}

/**
 * Link wrapper for book and chapter routes that layers warmup behavior on top
 * of `next/link`.
 *
 * Lifecycle overview:
 *
 * - On touch/coarse-pointer devices, visibility in the viewport warms the
 *   route. Leaving the viewport cancels that speculative warmup.
 * - On fine-pointer desktop devices, pointer proximity warms the route before
 *   hover. Moving away cancels that speculative warmup.
 * - On focus or mouse enter, the route is warmed with the strongest
 *   speculative priority because user intent is now much clearer.
 * - When Next confirms a real client-side navigation through `onNavigate`, the
 *   component claims the existing warmup so cleanup does not abort an inflight
 *   request. If the task was still queued, the scheduler drops it instead of
 *   letting it race behind the real navigation.
 *
 * `prefetch={false}` disables Next's viewport-based prefetching for this link
 * so the custom scheduler owns that part of the lifecycle.
 */
export function SSRPrefetchLink({
  href,
  children,
  onClick,
  onNavigate,
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
      // Touch and coarse-pointer devices do not have a reliable hover stage,
      // so visibility becomes the speculative warm signal.
      hasViewportWarmup.current = true;
      requestBookRouteWarmup(href, 'viewport');
    } else if (hasViewportWarmup.current) {
      // Once the link leaves the viewport, the original reason for warming it
      // is gone. Pending work is dropped and inflight work is aborted unless a
      // stronger signal, such as a click claim, already took ownership.
      cancelBookRouteWarmup(href);
      hasViewportWarmup.current = false;
    }

    return () => {
      // Component unmount should clean up any speculation it originated.
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
      // On desktop, pointer proximity gets a head start before explicit hover
      // without warming the entire visible list.
      hasPointerWarmup.current = true;
      requestBookRouteWarmup(href, 'pointer');
    } else if (hasPointerWarmup.current) {
      // As with viewport warming, pointer warming is only justified while the
      // pointer is still nearby.
      cancelBookRouteWarmup(href);
      hasPointerWarmup.current = false;
    }

    return () => {
      // Unmount cleanup mirrors the viewport lifecycle.
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
      onClick={(event) => {
        onClick?.(event);

        if (event.defaultPrevented) {
          // If the caller already blocked the click, Next will not navigate and
          // the warmup lifecycle should stay purely speculative.
          return;
        }
      }}
      onNavigate={(event) => {
        let navigatePrevented = false;

        onNavigate?.({
          preventDefault: () => {
            navigatePrevented = true;
            event.preventDefault();
          },
        });

        if (!navigatePrevented) {
          // This is the transition point from speculation to real navigation.
          // The scheduler will keep an inflight request alive or drop a queued
          // task that would otherwise fire too late and duplicate the router's
          // own fetch.
          claimBookRouteWarmup(href);
        }
      }}
      onFocus={(event) => {
        onFocus?.(event);
        // Keyboard focus is treated like hover because it is a strong signal of
        // immediate navigation intent.
        requestBookRouteWarmup(href, 'hover');
      }}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        // Hover gets the highest speculative priority because it usually means
        // the next user action is a click.
        requestBookRouteWarmup(href, 'hover');
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
