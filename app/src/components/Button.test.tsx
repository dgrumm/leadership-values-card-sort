import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Button, type ButtonSize, type ButtonVariant } from './Button';

afterEach(cleanup);

const VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger'];
const SIZES: ButtonSize[] = ['sm', 'md', 'lg'];

// min-h-11/min-w-11 (2.75rem = 44px at the default 16px root) is the WCAG
// 2.5.5 touch-target floor; every variant/size combination must keep it.
describe('Button touch targets', () => {
  for (const variant of VARIANTS) {
    for (const size of SIZES) {
      it(`${variant}/${size} keeps a >=44x44px target`, () => {
        render(
          <Button variant={variant} size={size}>
            Go
          </Button>,
        );
        const button = screen.getByRole('button', { name: 'Go' });
        expect(button.className).toContain('min-h-11');
        expect(button.className).toContain('min-w-11');
        cleanup();
      });
    }
  }
});

describe('Button', () => {
  it('forwards native button props', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button', { name: 'Disabled' })).toHaveProperty('disabled', true);
  });
});
