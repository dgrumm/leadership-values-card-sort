import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RevealControl } from './RevealControl';

const BASE_PROPS = {
  round: 1,
  roundName: 'Round 1',
  ranked: false,
  revealed: false,
  dismissed: false,
};

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
});

describe('RevealControl', () => {
  it('shows the explainer before the first-ever reveal in this browser; confirming it proceeds to reveal', async () => {
    const user = userEvent.setup();
    const onReveal = vi.fn();
    render(
      <RevealControl {...BASE_PROPS} onDismiss={vi.fn()} onReveal={onReveal} onUnreveal={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Reveal' }));
    expect(screen.getByRole('dialog', { name: 'Sharing your result' })).not.toBeNull();
    expect(onReveal).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Got it, share' }));
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('skips the explainer on a later reveal once this browser has seen it', async () => {
    localStorage.setItem('vc:reveal-explainer-seen', '1');
    const user = userEvent.setup();
    const onReveal = vi.fn();
    render(
      <RevealControl {...BASE_PROPS} onDismiss={vi.fn()} onReveal={onReveal} onUnreveal={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Reveal' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it('dismisses without revealing, and never renders a disabled Continue (no such control here at all)', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const onReveal = vi.fn();
    render(
      <RevealControl {...BASE_PROPS} onDismiss={onDismiss} onReveal={onReveal} onUnreveal={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onReveal).not.toHaveBeenCalled();
  });

  it('renders nothing but the dismiss decision once dismissed', () => {
    render(
      <RevealControl {...BASE_PROPS} dismissed onDismiss={vi.fn()} onReveal={vi.fn()} onUnreveal={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'Reveal' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();
  });

  it('shows "Shared ✓" and an Un-reveal action once revealed', async () => {
    const user = userEvent.setup();
    const onUnreveal = vi.fn();
    render(
      <RevealControl {...BASE_PROPS} revealed onDismiss={vi.fn()} onReveal={vi.fn()} onUnreveal={onUnreveal} />,
    );

    expect(screen.getByRole('status').textContent).toBe('Shared ✓');
    await user.click(screen.getByRole('button', { name: 'Un-reveal' }));
    expect(onUnreveal).toHaveBeenCalledTimes(1);
  });
});
