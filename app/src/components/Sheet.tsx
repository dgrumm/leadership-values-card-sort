import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface SheetProps {
  open: boolean;
  /** Closes on Escape when provided. Without it the sheet has no keyboard dismissal. */
  onClose?: () => void;
  children?: ReactNode;
}

/**
 * Minimal bottom sheet, anchored above modals.
 *
 * Height is bounded: an unbounded `bottom-0` sheet grows upward as content grows, and once
 * it exceeds the viewport its top — where dismiss controls live — is pushed off-screen with
 * nothing to scroll, stranding the user (this happened with a full kept tray). Content that
 * can grow must live in its own `overflow-y-auto` child so dismiss controls stay put.
 */
export function Sheet({ open, onClose, children }: SheetProps) {
  useEffect(() => {
    if (!open || !onClose) return;
    const close = onClose;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      role="region"
      className="fixed inset-x-0 bottom-0 z-sheet flex max-h-[85dvh] flex-col rounded-t-sheet border border-glass-edge bg-glass-strong p-6 shadow-glass backdrop-blur-[var(--glass-blur)]"
    >
      {children}
    </div>,
    document.body,
  );
}
