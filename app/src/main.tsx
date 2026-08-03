import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { KitchenSink } from './routes/KitchenSink';
import { Landing } from './routes/Landing';
import { Sort } from './routes/Sort';
import { MotionProvider } from './theme/motion';
import './theme/tokens.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

// Still a hardcoded pathname check, not a router — join/create flows (01.1/01.2)
// haven't landed yet, so /sort is a fixed-config demo entry point rather than a
// real session route. A real router arrives once those specs need one.
function currentRoute() {
  switch (window.location.pathname) {
    case '/kitchen-sink':
      return <KitchenSink />;
    case '/sort':
      return <Sort />;
    default:
      return <Landing />;
  }
}

createRoot(rootElement).render(
  <StrictMode>
    <MotionProvider>{currentRoute()}</MotionProvider>
  </StrictMode>,
);
