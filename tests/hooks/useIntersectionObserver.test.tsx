/**
 * Tests for useIntersectionObserver hook
 */

import React from 'react';
import { renderHook } from '@testing-library/react';
import { useIntersectionObserver } from 'hooks/useIntersectionObserver';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock IntersectionObserver
const observeMock = vi.fn();
const disconnectMock = vi.fn();
const unobserveMock = vi.fn();

describe('useIntersectionObserver', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    observeMock.mockClear();
    disconnectMock.mockClear();
    unobserveMock.mockClear();

    // Setup IntersectionObserver mock
    global.IntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: observeMock,
      disconnect: disconnectMock,
      unobserve: unobserveMock,
    })) as unknown as typeof IntersectionObserver;
  });

  it('should return a ref and initial isIntersecting false', () => {
    const { result } = renderHook(() => useIntersectionObserver());

    expect(result.current.ref).toBeDefined();
    expect(result.current.ref.current).toBeNull();
    expect(result.current.isIntersecting).toBe(false);
  });

  it('should not create observer when enabled is false', () => {
    renderHook(() => useIntersectionObserver({ enabled: false }));

    // IntersectionObserver should not be created when disabled
    expect(global.IntersectionObserver).not.toHaveBeenCalled();
  });

  it('should support generic type parameter', () => {
    const { result } = renderHook(() =>
      useIntersectionObserver<HTMLDivElement>()
    );

    // Type assertion to verify the ref type is correct
    const _ref: React.RefObject<HTMLDivElement | null> = result.current.ref;

    expect(_ref).toBeDefined();
  });
});
