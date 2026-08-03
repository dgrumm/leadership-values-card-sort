export interface ToastProps {
  message: string;
  variant?: 'default' | 'danger' | 'success';
}

const VARIANT_CLASSES: Record<NonNullable<ToastProps['variant']>, string> = {
  default: 'bg-ink text-surface',
  danger: 'bg-danger text-on-accent',
  success: 'bg-success text-on-accent',
};

/** Minimal toast: caller owns mount timing/queueing (02.1 composes that). */
export function Toast({ message, variant = 'default' }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`z-toast rounded-control px-4 py-3 text-sm shadow-card-lifted ${VARIANT_CLASSES[variant]}`}
    >
      {message}
    </div>
  );
}
