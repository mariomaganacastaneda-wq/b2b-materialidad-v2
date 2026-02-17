import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ClerkProvider } from "@clerk/clerk-react"

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const rootElement = document.getElementById('root')!;

if (!PUBLISHABLE_KEY) {
  createRoot(rootElement).render(
    <div style={{ padding: '40px', background: '#0f172a', color: 'white', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: 'system-ui' }}>
      <div style={{ background: '#450a0a', padding: '30px', borderRadius: '12px', border: '1px solid #991b1b', maxWidth: '500px' }}>
        <h1 style={{ color: '#fecaca', marginBottom: '16px' }}>⚠️ Error de Despliegue</h1>
        <p style={{ color: '#fca5a5', fontSize: '14px', lineHeight: '1.5' }}>
          La aplicación no puede iniciarse porque falta la clave: <br />
          <strong style={{ color: 'white' }}>VITE_CLERK_PUBLISHABLE_KEY</strong>
        </p>
        <p style={{ marginTop: '20px', color: '#94a3b8', fontSize: '12px' }}>
          Por favor, agrega esta variable en el panel de Vercel y realiza un redeploy.
        </p>
      </div>
    </div>
  );
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        <App />
      </ClerkProvider>
    </StrictMode>,
  )
}
