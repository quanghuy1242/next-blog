import React, { useEffect, useRef, useState } from 'react';

export interface UsePointerProximityObserverOptions<
  T extends HTMLElement = HTMLElement
> {
  /**
   * If true, starts observing immediately.
   * If false, the observer stays idle.
   * @default true
   */
  enabled?: boolean;

  /**
   * Optional external ref to observe.
   * If omitted, the hook creates its own ref.
   */
  targetRef?: React.RefObject<T | null>;

  /**
   * Horizontal margin around the pointer.
   * @default 120
   */
  xMargin?: number;

  /**
   * Vertical margin around the pointer.
   * @default 90
   */
  yMargin?: number;
}

export interface UsePointerProximityObserverResult<
  T extends HTMLElement = HTMLElement
> {
  /**
   * Ref to attach to the element you want to observe.
   */
  ref: React.RefObject<T | null>;

  /**
   * Whether the element is currently inside the pointer proximity window.
   */
  isProximate: boolean;
}

interface PointerPoint {
  x: number;
  y: number;
}

interface PointerProximitySubscription {
  element: HTMLElement;
  xMargin: number;
  yMargin: number;
  isProximate: boolean;
  onChange: (isProximate: boolean) => void;
}

const DEFAULT_X_MARGIN = 120;
const DEFAULT_Y_MARGIN = 90;

const subscriptions = new Set<PointerProximitySubscription>();

let activePointer: PointerPoint | null = null;
let scheduledFrame: number | null = null;
let listenersAttached = false;

function isWithinPointerWindow(
  element: HTMLElement,
  pointer: PointerPoint | null,
  xMargin: number,
  yMargin: number
): boolean {
  if (!pointer) {
    return false;
  }

  const rect = element.getBoundingClientRect();

  return (
    rect.right >= pointer.x - xMargin &&
    rect.left <= pointer.x + xMargin &&
    rect.bottom >= pointer.y - yMargin &&
    rect.top <= pointer.y + yMargin
  );
}

function evaluateSubscriptions(): void {
  for (const subscription of subscriptions) {
    const nextIsProximate = isWithinPointerWindow(
      subscription.element,
      activePointer,
      subscription.xMargin,
      subscription.yMargin
    );

    if (nextIsProximate === subscription.isProximate) {
      continue;
    }

    subscription.isProximate = nextIsProximate;
    subscription.onChange(nextIsProximate);
  }
}

function scheduleEvaluation(): void {
  if (
    typeof window === 'undefined' ||
    scheduledFrame !== null ||
    subscriptions.size === 0
  ) {
    return;
  }

  scheduledFrame = window.requestAnimationFrame(() => {
    scheduledFrame = null;
    evaluateSubscriptions();
  });
}

function handlePointerMove(event: PointerEvent): void {
  if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') {
    return;
  }

  activePointer = {
    x: event.clientX,
    y: event.clientY,
  };

  scheduleEvaluation();
}

function handleScrollOrResize(): void {
  if (!activePointer) {
    return;
  }

  scheduleEvaluation();
}

function handleWindowBlur(): void {
  activePointer = null;
  scheduleEvaluation();
}

function handleVisibilityChange(): void {
  if (typeof document !== 'undefined' && document.hidden) {
    activePointer = null;
    scheduleEvaluation();
  }
}

function attachListeners(): void {
  if (listenersAttached || typeof window === 'undefined') {
    return;
  }

  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  window.addEventListener('scroll', handleScrollOrResize, {
    capture: true,
    passive: true,
  });
  window.addEventListener('resize', handleScrollOrResize, { passive: true });
  window.addEventListener('blur', handleWindowBlur);

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  listenersAttached = true;
}

function detachListeners(): void {
  if (!listenersAttached || subscriptions.size > 0 || typeof window === 'undefined') {
    return;
  }

  window.removeEventListener('pointermove', handlePointerMove);
  window.removeEventListener('scroll', handleScrollOrResize, true);
  window.removeEventListener('resize', handleScrollOrResize);
  window.removeEventListener('blur', handleWindowBlur);

  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }

  if (scheduledFrame !== null) {
    window.cancelAnimationFrame(scheduledFrame);
    scheduledFrame = null;
  }

  activePointer = null;
  listenersAttached = false;
}

function registerPointerProximitySubscription(
  element: HTMLElement,
  onChange: (isProximate: boolean) => void,
  xMargin: number,
  yMargin: number
): () => void {
  const subscription: PointerProximitySubscription = {
    element,
    isProximate: false,
    onChange,
    xMargin,
    yMargin,
  };

  subscriptions.add(subscription);
  attachListeners();
  scheduleEvaluation();

  return () => {
    subscriptions.delete(subscription);

    if (subscriptions.size === 0) {
      detachListeners();
    }
  };
}

export function usePointerProximityObserver<T extends HTMLElement = HTMLElement>(
  options: UsePointerProximityObserverOptions<T> = {}
): UsePointerProximityObserverResult<T> {
  const {
    enabled = true,
    targetRef,
    xMargin = DEFAULT_X_MARGIN,
    yMargin = DEFAULT_Y_MARGIN,
  } = options;

  const internalRef = useRef<T>(null);
  const ref = targetRef ?? internalRef;
  const [isProximate, setIsProximate] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const element = ref.current;
    if (!element) {
      return;
    }

    return registerPointerProximitySubscription(
      element,
      setIsProximate,
      xMargin,
      yMargin
    );
  }, [enabled, ref, xMargin, yMargin]);

  return {
    ref,
    isProximate,
  };
}
