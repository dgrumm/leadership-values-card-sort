import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

afterEach(cleanup);

function ToggleFixture() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open trigger
      </button>
      <Modal open={open} title="Settings" onClose={() => setOpen(false)}>
        <button type="button">First</button>
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('sets role=dialog and aria-modal', () => {
    render(<Modal open title="Settings" onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('renders nothing when closed', () => {
    render(<Modal open={false} title="Settings" onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('moves focus into the dialog on open', () => {
    render(
      <Modal open title="Settings" onClose={() => {}}>
        <button type="button">First</button>
      </Modal>,
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));
  });

  it('cycles focus forward and backward within the trap (Tab / Shift+Tab)', () => {
    render(
      <Modal open title="Settings" onClose={() => {}}>
        <button type="button">First</button>
        <button type="button">Second</button>
      </Modal>,
    );
    const first = screen.getByRole('button', { name: 'First' });
    const second = screen.getByRole('button', { name: 'Second' });
    expect(document.activeElement).toBe(first);

    second.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(second);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Settings" onClose={onClose}>
        <button type="button">First</button>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on overlay click but not on content click', () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Settings" onClose={onClose}>
        <button type="button">First</button>
      </Modal>,
    );
    fireEvent.mouseDown(screen.getByRole('button', { name: 'First' }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('restores focus to the trigger element on close', () => {
    render(<ToggleFixture />);
    const trigger = screen.getByRole('button', { name: 'Open trigger' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(trigger);
  });
});
