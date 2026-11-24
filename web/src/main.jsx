import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LazyMotion, MotionConfig } from 'motion/react';
import App from './App.jsx';
import './styles.css';

// Motion: only the features the app uses (domAnimation, downloaded right after the first paint), and none of the
// movement for people who ask for less.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <LazyMotion features={() => import('./motion-features.js').then((mod) => mod.default)} strict>
        <App />
      </LazyMotion>
    </MotionConfig>
  </StrictMode>,
);
