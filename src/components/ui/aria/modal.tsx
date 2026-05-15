'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import cn from 'classnames';
import {
  Modal as AriaModal,
  ModalOverlay,
  type ModalOverlayProps,
} from 'react-aria-components/Modal';
import { Dialog } from 'react-aria-components/Dialog';
import { X } from 'lucide-react';
import { Button } from './button';

export interface ModalProps extends Omit<ModalOverlayProps, 'children'> {
  children: ReactNode;
  title?: ReactNode;
  className?: string;
  contentClassName?: string;
  closeLabel?: string;
}

export function Modal({
  children,
  title,
  className,
  contentClassName,
  closeLabel = 'Close',
  isDismissable = true,
  ...props
}: ModalProps) {
  useEffect(() => {
    if (!props.isOpen) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        props.onOpenChange?.(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousBodyOverflow === 'hidden' ? '' : previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow === 'hidden' ? '' : previousHtmlOverflow;
    };
  }, [props]);

  return (
    <ModalOverlay
      {...props}
      isDismissable={isDismissable}
      className={cn(
        'modal modal-open bg-black/40',
        'data-[entering]:animate-in data-[exiting]:animate-out',
        className
      )}
    >
      <AriaModal
        className={cn(
          'modal-box max-h-[80vh] overflow-hidden rounded-t-lg rounded-b-none p-4 shadow-dark sm:rounded-lg',
          contentClassName
        )}
      >
        <Dialog
          aria-label={typeof title === 'string' ? title : closeLabel}
          className="flex max-h-[calc(80vh-2rem)] min-h-0 flex-col outline-none"
        >
          {({ close }) => (
            <>
              <div className="mb-3 flex flex-none items-center justify-between gap-3">
                {title ? (
                  <h2 className="text-sm font-semibold text-base-content">{title}</h2>
                ) : null}
                <Button
                  type="button"
                  onPress={close}
                  variant="secondary"
                  size="icon"
                  aria-label={closeLabel}
                  className="ml-auto"
                >
                  <X aria-hidden className="h-4 w-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {children}
              </div>
            </>
          )}
        </Dialog>
      </AriaModal>
    </ModalOverlay>
  );
}
