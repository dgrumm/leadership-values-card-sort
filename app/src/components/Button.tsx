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
  danger: 'bg-danger text-on-accent',
};

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
      className={`inline-flex items-center justify-center rounded-control font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${HIT_TARGET} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  );
}
