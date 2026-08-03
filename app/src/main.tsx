import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { KitchenSink } from './routes/KitchenSink';
import { Landing } from './routes/Landing';
import { MotionProvider } from './theme/motion';
import './theme/tokens.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

// No router yet (00.3 is dev-only routing for the primitives showcase).
// Real routing lands with the sort loop (01.3).
const isKitchenSink = window.location.pathname === '/kitchen-sink';

createRoot(rootElement).render(
  <StrictMode>
    <MotionProvider>{isKitchenSink ? <KitchenSink /> : <Landing />}</MotionProvider>
  </StrictMode>,
);
