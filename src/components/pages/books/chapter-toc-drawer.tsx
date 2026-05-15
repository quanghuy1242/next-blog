import React from 'react';
import type { ReactNode } from 'react';
import { Modal } from '@/components/ui/aria/modal';

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
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      isDismissable
      title="Table of contents"
      closeLabel="Close chapter table of contents"
      className="lg:hidden"
      contentClassName="absolute inset-x-0 bottom-0 m-0 h-[80vh] w-full max-w-none sm:inset-auto sm:m-auto sm:h-auto sm:max-w-lg"
    >
      {children}
    </Modal>
  );
}
