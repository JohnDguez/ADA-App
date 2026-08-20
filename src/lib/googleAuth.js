// ── Google Identity Services (GIS) — flujo de ID Token ──────────────────────
// Reemplaza el flujo estándar de supabase.auth.signInWithOAuth (que muestra
// la URL de Supabase en la pantalla de consentimiento de Google) por el flujo
// nativo de Google, donde la petición sale directo del dominio de la app
// (my.luna-pay.app) y Supabase solo valida el id_token por debajo con
// supabase.auth.signInWithIdToken().
//
// El botón oficial de Google se renderiza OCULTO (fuera de pantalla) y se
// dispara con un click simulado desde el botón custom de AuthPage.jsx — así
// la UI no cambia nada visualmente, solo cambia qué pasa por debajo.

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

let scriptLoadPromise = null

// Carga el script de GIS una sola vez, sin importar cuántas veces se monte AuthPage
export function loadGoogleIdentityScript() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptLoadPromise) return scriptLoadPromise

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.src = GIS_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = reject
    document.head.appendChild(script)
  })
  return scriptLoadPromise
}

// Nonce aleatorio (crudo, para signInWithIdToken) + su versión hasheada
// SHA-256 en hex (para el initialize de Google) — Supabase exige que la
// versión que recibe Google esté hasheada, y la que recibe Supabase no.
export async function generateNonce() {
  const rawArray = new Uint8Array(32)
  window.crypto.getRandomValues(rawArray)
  const rawNonce = Array.from(rawArray, b => b.toString(16).padStart(2, '0')).join('')

  const encoder = new TextEncoder()
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(rawNonce))
  const hashedNonce = Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('')

  return { rawNonce, hashedNonce }
}
