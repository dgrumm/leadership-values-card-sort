import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Button, type ButtonVariant } from '../components/Button';
import { GameCard } from '../components/GameCard';
import { Modal } from '../components/Modal';
import { Sheet } from '../components/Sheet';
import { Toast } from '../components/Toast';

const VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger'];

/**
 * Dev-only showcase of every 00.3 primitive, driven only by tokens.
 * Excluded from app navigation; used by E2E and visual review.
 */
export function KitchenSink() {
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <main className="flex min-h-screen flex-col gap-10 bg-surface p-8 text-ink">
      <h1 className="font-display text-3xl font-bold">Kitchen sink</h1>

      <section aria-labelledby="buttons-heading" className="flex flex-col gap-4">
        <h2 id="buttons-heading" className="text-xl font-semibold">
          Buttons
        </h2>
        <div className="flex flex-wrap gap-4">
          {VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </div>
      </section>

      <section aria-labelledby="cards-heading" className="flex flex-col gap-4">
        <h2 id="cards-heading" className="text-xl font-semibold">
          Game cards
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <GameCard size="sm" title="Courage" description="Acting despite fear" />
          <GameCard size="md" title="Curiosity" description="Seeking to understand" />
          <GameCard size="lg" title="Integrity" description="Consistency of values and action" />
          <GameCard size="md" title="Trust" flipped />
        </div>
      </section>

      <section aria-labelledby="avatars-heading" className="flex flex-col gap-4">
        <h2 id="avatars-heading" className="text-xl font-semibold">
          Avatars
        </h2>
        <div className="flex gap-4">
          <Avatar name="Dana" hue={20} />
          <Avatar name="Priya" hue={140} />
          <Avatar name="Omar" hue={260} />
        </div>
      </section>

      <section aria-labelledby="toast-heading" className="flex flex-col gap-4">
        <h2 id="toast-heading" className="text-xl font-semibold">
          Toasts
        </h2>
        <div className="flex flex-col gap-2">
          <Toast message="Saved." variant="success" />
          <Toast message="Could not connect." variant="danger" />
        </div>
      </section>

      <section aria-labelledby="overlays-heading" className="flex flex-col gap-4">
        <h2 id="overlays-heading" className="text-xl font-semibold">
          Modal & sheet
        </h2>
        <div className="flex gap-4">
          <Button onClick={() => setModalOpen(true)}>Open modal</Button>
          <Button variant="secondary" onClick={() => setSheetOpen((current) => !current)}>
            Toggle sheet
          </Button>
        </div>
        <Modal open={modalOpen} title="Round settings" onClose={() => setModalOpen(false)}>
          <p className="mb-4 text-ink-muted">Modal content lives here.</p>
          <Button onClick={() => setModalOpen(false)}>Close</Button>
        </Modal>
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
          <p className="text-ink-muted">Sheet content lives here.</p>
        </Sheet>
      </section>
    </main>
  );
}
