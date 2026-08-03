import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Create } from './Create';

afterEach(cleanup);

describe('Create', () => {
  it('disables Create game until a name is entered', () => {
    render(<Create />);
    expect(screen.getByRole('button', { name: 'Create game' })).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Coach' } });
    expect(screen.getByRole('button', { name: 'Create game' })).toHaveProperty('disabled', false);
  });

  it('disables Create game once the designer produces an invalid config (switching to a too-small deck)', () => {
    render(<Create />);
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Coach' } });
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));

    // The classic template's "Top 8" round needs 8 cards — Dev 12 (12 cards) still
    // fits, so switch further down: pick Dev 12, then push a round's keep above it.
    fireEvent.click(screen.getByRole('radio', { name: /Dev 12/ }));
    const keepInputs = screen.getAllByRole('spinbutton', { name: 'Keep count' });
    fireEvent.change(keepInputs[0] as HTMLElement, { target: { value: '20' } });

    expect(screen.getByRole('button', { name: 'Create game' })).toHaveProperty('disabled', true);
  });
});
