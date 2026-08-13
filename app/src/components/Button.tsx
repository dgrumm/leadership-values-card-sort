import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'bg-surface-raised text-ink border border-ink-muted hover:bg-accent-subtle',
  ghost: 'bg-transparent text-ink hover:bg-accent-subtle',
  // `danger` was the one variant with no hover response at all.
  danger: 'bg-danger text-on-accent hover:brightness-90',
};

/*
 * States every variant shares.
 *
 * `disabled:` is the load-bearing one: `disabled` is genuinely passed (Join's
 * quick-create, the lobby's save-changes gate), and without styling a disabled
 * button was pixel-identical to an enabled one — the control said "press me"
 * while refusing to respond. That is a correctness bug, not polish.
 *
 * `active:` gives the press a 1px acknowledgement. Deliberately no loading /
 * error / success states: nothing in the app drives them (callers express
 * pending work through the label, e.g. 'Creating…'), and an unused prop is a
 * prop that rots.
 */
const STATE_CLASSES =
  'active:translate-y-px ' +
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-inherit ' +
  'disabled:active:translate-y-0';

// Every size keeps at least a 44x44px hit target (WCAG 2.5.5), padding grows
// text/visual size on top of that floor rather than shrinking the target.
const HIT_TARGET = 'min-h-11 min-w-11';
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-4 text-sm',
  md: 'px-6 text-base',
  lg: 'px-8 text-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-control font-semibold transition-[background-color,transform] duration-[var(--duration-snap)] ease-out focus-visible:outline-none focus-visible:shadow-focus ${HIT_TARGET} ${STATE_CLASSES} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  );
}
