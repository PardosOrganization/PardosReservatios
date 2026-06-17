/**
 * main.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Punto de entrada principal de la aplicación React.
 * Aquí se monta el componente raíz <App /> en el DOM y se envuelve con el
 * proveedor global de toast notifications (react-hot-toast).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    {/* Toaster global para notificaciones tipo toast en toda la app */}
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          background: '#fff8f0',
          color: '#3b1a1a',
          border: '1px solid #e8453c22',
          borderRadius: '12px',
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px',
        },
        success: {
          iconTheme: { primary: '#e8453c', secondary: '#fff8f0' },
        },
        error: {
          iconTheme: { primary: '#c0392b', secondary: '#fff8f0' },
        },
      }}
    />
  </StrictMode>,
)
