import React from 'react';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/shared/ui/button';

interface ChapterTocDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function ChapterTocDrawer({
  isOpen,
  onClose,
  children,
}: ChapterTocDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close chapter table of contents"
        className="absolute inset-0 z-0 bg-black/40"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 z-10 overflow-hidden rounded-t-lg bg-white p-4 shadow-dark"
        style={{ height: '80vh', WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="mb-3 flex flex-none items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-900">Table of contents</h2>
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              size="sm"
              className="px-2 py-1 text-xs"
            >
              Close
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
