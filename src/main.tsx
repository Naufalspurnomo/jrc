import './styles/base/fonts.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './app/App';
import './styles/base/app.css';
import './styles/sections/showcase.css';
import './styles/sections/hero-layout.css';
import './styles/sections/hero-composition.css';
import './styles/sections/hero-theme.css';
import './styles/sections/event-brief.css';
import './styles/sections/history.css';
import './styles/sections/legacy-layout.css';
import './styles/system/responsive.css';
import './styles/sections/schedule.css';
import './styles/system/performance.css';
import './styles/system/site-shell.css';
import './styles/sections/lower-world.css';
import './styles/system/motion.css';

const root = document.getElementById('root');

if (!root) throw new Error('Elemen aplikasi JRC tidak ditemukan.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
