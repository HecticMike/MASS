import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

const basename = import.meta.env.BASE_URL ?? '/'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const swUrl = new URL('sw.js', window.location.origin + basename)
    navigator.serviceWorker
      .register(swUrl.toString(), { type: 'module' })
      .catch((error) => {
        console.error('Service worker registration failed', error)
      })
  })
}
