import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import FarmingPreviewMount from './components/Farming/FarmingPreviewMount'
import { sanitizeLocalStorage } from './utils/storageSanitizer'
import { initGraphicsSettings } from './utils/graphicsSettings'

// Sanitize legacy browser cache before mounting React app
sanitizeLocalStorage()
initGraphicsSettings()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <FarmingPreviewMount />
  </StrictMode>,
)
