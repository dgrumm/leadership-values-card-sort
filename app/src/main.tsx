import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Create } from './routes/Create';
import { Join } from './routes/Join';
import { KitchenSink } from './routes/KitchenSink';
import { Landing } from './routes/Landing';
import { Sort } from './routes/Sort';
import { Wall } from './routes/wall/Wall';
import { MotionProvider } from './theme/motion';
import './theme/tokens.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

const JOIN_PATH_PATTERN = /^\/join(?:\/([A-Z0-9]{6}))?$/i;
const WALL_PATH_PATTERN = /^\/wall\/([A-Z0-9]{6})$/i;

// Still a hardcoded pathname check, not a router — `/sort` remains a fixed-config
// demo entry point (wiring it to a real joined session is a later spec); a real
// router arrives once a spec actually needs one.
function currentRoute() {
  const path = window.location.pathname;
  const joinMatch = path.match(JOIN_PATH_PATTERN);
  if (joinMatch) return <Join code={joinMatch[1]} />;
  const wallMatch = path.match(WALL_PATH_PATTERN);
  if (wallMatch) return <Wall code={(wallMatch[1] as string).toUpperCase()} />;
  switch (path) {
    case '/create':
      return <Create />;
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
