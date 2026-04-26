import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { usePointerProximityObserver } from 'hooks/usePointerProximityObserver';

function Probe() {
  const ref = React.useRef<HTMLDivElement>(null);
  const { isProximate } = usePointerProximityObserver({
    targetRef: ref,
  });

  return (
    <div ref={ref} data-testid="probe" data-proximate={String(isProximate)} />
  );
}

describe('usePointerProximityObserver', () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;

  beforeEach(() => {
    window.requestAnimationFrame = vi
      .fn((callback: FrameRequestCallback) => {
        const timeoutId = window.setTimeout(() => {
          callback(0);
        }, 0);
        return timeoutId as unknown as number;
      }) as never;
    window.cancelAnimationFrame = vi.fn((timeoutId: number) => {
      window.clearTimeout(timeoutId);
    }) as never;
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    vi.restoreAllMocks();
  });

  test('tracks pointer proximity and cancellation around the observed element', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    render(<Probe />);

    const probe = screen.getByTestId('probe');
    Object.defineProperty(probe, 'getBoundingClientRect', {
      configurable: true,
      value: () =>
        ({
          bottom: 180,
          height: 120,
          left: 40,
          right: 280,
          top: 60,
          width: 240,
          x: 40,
          y: 60,
          toJSON: () => ({}),
        }) as DOMRect,
    });

    await waitFor(() => {
      expect(
        addEventListenerSpy.mock.calls.some(([type]) => type === 'pointermove')
      ).toBe(true);
    });

    const pointerMoveHandler = addEventListenerSpy.mock.calls.find(
      ([type]) => type === 'pointermove'
    )?.[1] as ((event: PointerEvent) => void) | undefined;

    await act(async () => {
      pointerMoveHandler?.({
        clientX: 120,
        clientY: 100,
        pointerType: 'mouse',
      } as PointerEvent);
    });

    await waitFor(() => {
      expect(screen.getByTestId('probe')).toHaveAttribute(
        'data-proximate',
        'true'
      );
    });

    await act(async () => {
      pointerMoveHandler?.({
        clientX: 1000,
        clientY: 1000,
        pointerType: 'mouse',
      } as PointerEvent);
    });

    await waitFor(() => {
      expect(screen.getByTestId('probe')).toHaveAttribute(
        'data-proximate',
        'false'
      );
    });
  });
});
