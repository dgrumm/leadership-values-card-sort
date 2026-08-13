import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus-trapped dialog rendered in a portal at `--z-index-modal`. Moves focus
 * in on open, cycles Tab/Shift+Tab within its content, restores focus to the
 * trigger on close, and closes on Escape or overlay click.
 *
 * Sizing lives here, not in callers: `m-4` keeps a gutter at 320-375px (where
 * `max-w-md` alone ran the dialog edge-to-edge), and `max-h` + `overflow-y-auto`
 * mean tall content scrolls instead of overflowing the viewport unreachably.
 * The lobby used to hand-roll its own `max-h-[70vh] overflow-y-auto` to work
 * around their absence.
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const dialog = dialogRef.current;
    const focusables = dialog
      ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      : [];
    (focusables[0] ?? dialog)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const current = dialogRef.current;
      if (!current) return;
      const items = Array.from(current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0] as HTMLElement;
      const last = items[items.length - 1] as HTMLElement;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="scrim fixed inset-0 z-modal flex items-center justify-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className="m-4 max-h-[85vh] max-w-md overflow-y-auto rounded-sheet panel-strong p-6 outline-none"
      >
        <h2 id="modal-title" className="mb-4 font-display text-xl font-semibold text-ink">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
