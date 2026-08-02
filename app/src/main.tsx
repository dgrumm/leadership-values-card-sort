import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Landing } from './routes/Landing';
import './theme/tokens.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
