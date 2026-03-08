import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'
import { polyfill } from "mobile-drag-drop";
import "mobile-drag-drop/default.css";

// Polyfill HTML5 drag and drop for touch devices
polyfill({
  // Use a delay to allow scrolling before drag starts, typical of mobile apps
  holdToDrag: 300,
});

// Needed to make scroll work together with drag and drop polyfill
window.addEventListener('touchmove', function () { }, { passive: false });

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('新しいバージョンが利用可能です。リロードして更新しますか？')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
