import React from 'react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

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
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
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
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[80vh] rounded-t-lg bg-white p-4 shadow-dark">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Table of contents</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
