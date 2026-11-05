import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import FarmingPreviewMount from './components/Farming/FarmingPreviewMount'
import { sanitizeLocalStorage } from './utils/storageSanitizer'
import { initGraphicsSettings } from './utils/graphicsSettings'
import { initNetworkSettings } from './utils/networkSettings'

// Sanitize legacy browser cache before mounting React app
sanitizeLocalStorage()
initGraphicsSettings()
initNetworkSettings()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <FarmingPreviewMount />
  </StrictMode>,
)

if ('serviceWorker' in navigator && typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[PWA] SW register error:', err);
    });
  });
}
