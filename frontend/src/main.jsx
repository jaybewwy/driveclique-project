import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css' // palettes first: Tailwind's utilities must come after them
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { initTheme } from './lib/theme.js'

initTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
