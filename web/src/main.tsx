import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ClerkProvider } from "@clerk/clerk-react"

// --- MONITOR DE ERRORES PARA DEPURACIÓN EN PRODUCCIÓN ---
window.onerror = (msg, url, lineNo, columnNo, error) => {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 40px; background: #0f172a; color: white; min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: system-ui;">
        <div style="background: #450a0a; padding: 30px; border-radius: 12px; border: 1px solid #991b1b; max-width: 800px; overflow: auto;">
          <h1 style="color: #fecaca; margin-bottom: 16px;">💥 Error Crítico de Ejecución</h1>
          <p style="color: white; font-weight: bold;">${msg}</p>
          <pre style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; font-size: 12px; color: #fca5a5; margin-top: 15px;">
URL: ${url}
Línea: ${lineNo}
Columna: ${columnNo}
Stack: ${error?.stack || 'N/A'}
          </pre>
          <p style="margin-top: 20px; color: #94a3b8; fontSize: 12px;">Esto indica un error en el código minificado. Por favor, reporta este error.</p>
        </div>
      </div>
    `;
  }
  return false;
};

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
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
          <App />
        </ClerkProvider>
      </StrictMode>,
    )
  } catch (e: any) {
    console.error("Render crash:", e);
    // El window.onerror se encargará de mostrarlo si esto falla
  }
}
