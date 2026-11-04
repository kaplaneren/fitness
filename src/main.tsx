import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './style.css'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

navigator.storage?.persist?.().catch(() => {})

if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol === 'https:' && !location.hostname.endsWith('claude.ai')) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {})
}
