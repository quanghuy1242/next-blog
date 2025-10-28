/**
 * useIntersectionObserver Hook
 *
 * A reusable hook for detecting when an element enters the viewport using
 * the Intersection Observer API. Useful for lazy loading, infinite scroll,
 * and viewport-based animations.
 */

import React, { useEffect, useRef, useState } from 'react';

export interface UseIntersectionObserverOptions {
  /**
   * Margin around the root element (viewport by default)
   * @example '0px 0px 200px 0px' - Trigger 200px before entering viewport
   * @default '0px'
   */
  rootMargin?: string;

  /**
   * Percentage of target visibility required to trigger (0.0 to 1.0)
   * @example 0.5 - Trigger when 50% of element is visible
   * @default 0
   */
  threshold?: number | number[];

  /**
   * Element to use as the viewport for checking visibility
   * If null, defaults to browser viewport
   * @default null
   */
  root?: Element | null;

  /**
   * If true, stops observing after first intersection
   * Useful for one-time triggers like lazy loading
   * @default false
   */
  triggerOnce?: boolean;

  /**
   * If true, starts observing immediately
   * If false, caller must manually start observation
   * @default true
   */
  enabled?: boolean;
}

export interface UseIntersectionObserverResult<
  T extends HTMLElement = HTMLElement
> {
  /**
   * Ref to attach to the element you want to observe
   */
  ref: React.RefObject<T | null>;

  /**
   * Whether the element is currently intersecting
   */
  isIntersecting: boolean;

  /**
   * Full IntersectionObserverEntry if you need more details
   */
  entry?: IntersectionObserverEntry;
}

/**
 * Hook to observe when an element enters the viewport
 *
 * @example
 * ```tsx
 * function LazyImage({ src }) {
 *   const { ref, isIntersecting } = useIntersectionObserver({
 *     rootMargin: '100px',
 *     triggerOnce: true
 *   });
 *
 *   return (
 *     <div ref={ref}>
 *       {isIntersecting ? <img src={src} /> : <div>Loading...</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useIntersectionObserver<T extends HTMLElement = HTMLElement>(
  options: UseIntersectionObserverOptions = {}
): UseIntersectionObserverResult<T> {
  const {
    rootMargin = '0px',
    threshold = 0,
    root = null,
    triggerOnce = false,
    enabled = true,
  } = options;

  const ref = useRef<T>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry>();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const element = ref.current;
    if (!element) {
      return;
    }

    // Check if IntersectionObserver is supported
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: assume visible if IntersectionObserver not supported
      // Use a microtask to avoid synchronous setState in effect
      Promise.resolve().then(() => setIsIntersecting(true));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [firstEntry] = entries;
        if (firstEntry) {
          setEntry(firstEntry);
          setIsIntersecting(firstEntry.isIntersecting);

          // If triggerOnce and now intersecting, stop observing
          if (triggerOnce && firstEntry.isIntersecting) {
            observer.disconnect();
          }
        }
      },
      {
        rootMargin,
        threshold,
        root,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold, root, triggerOnce, enabled]);

  return {
    ref,
    isIntersecting,
    entry,
  };
}
