import './styles/fonts.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './app/App';
import './styles/index.css';
import './styles/showcase-hero.css';
import './styles/hero-redesign.css';
import './styles/hero-layer-fix.css';
import './styles/hero-festival.css';
import './styles/event-facts-civic.css';
import './styles/legacy-world.css';
import './styles/legacy-world-redesign.css';
import './styles/responsive-motion.css';
import './styles/schedule-editorial.css';
import './styles/startup-performance.css';
import './styles/site-polish.css';

const root = document.getElementById('root');

if (!root) throw new Error('Elemen aplikasi JRC tidak ditemukan.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
