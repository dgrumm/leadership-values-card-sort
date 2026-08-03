import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface SheetProps {
  open: boolean;
  children?: ReactNode;
}

/**
 * Minimal bottom sheet, anchored above modals. Full gesture/drag-to-dismiss
 * behavior is out of scope here — 01.3/02.1 compose interaction on top.
 */
export function Sheet({ open, children }: SheetProps) {
  if (!open) return null;
  return createPortal(
    <div
      role="region"
      className="fixed inset-x-0 bottom-0 z-sheet rounded-t-sheet bg-surface-raised p-6 shadow-sheet"
    >
      {children}
    </div>,
    document.body,
  );
}
