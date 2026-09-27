// Puente a Google Play Billing dentro de la app empaquetada con Capacitor
// (Android) — NUEVO (v0.9.525). Nunca se activa en web/PWA: Stripe sigue
// siendo la única pasarela ahí (arquitectura dual ya aprobada, ver
// CONTEXT.md → "Pendientes activos" → Distribución Android). Google exige
// Play Billing para cualquier suscripción vendida DENTRO de una app
// distribuida por Play Store — usar Stripe en el WebView de Android viola
// su política.
//
// `cordova-plugin-purchase` (declarado en package.json) es un plugin de
// Cordova, no un paquete ESM — Capacitor lo detecta como plugin de Cordova
// al correr `npx cap sync android` y lo inyecta como `window.CdvPurchase`
// dentro del WebView nativo. Por eso este archivo NUNCA hace
// `import ... from 'cordova-plugin-purchase'` (rompería/infllaría el build
// de Vite para web, que no tiene ese runtime) — siempre accede a
// `window.CdvPurchase` en tiempo de ejecución, y solo cuando la plataforma
// es Android.
//
// SIN PROBAR TODAVÍA — no existe build de Android real esta sesión (el
// proyecto Capacitor existe en el repo, pero este es el primer código que
// de verdad usa el plugin). Probar contra un build real de
// `npx cap sync android` + Android Studio antes de dar esto por cerrado.

// IDs de producto — DEBEN coincidir EXACTAMENTE con los que Johnatan haya
// creado en Play Console para los 2 productos de suscripción espejo
// (Mensual/Anual, ver CONTEXT.md). Si los IDs reales son distintos a estos,
// esta es la ÚNICA constante que hace falta editar aquí — y
// PLAN_BY_PRODUCT_ID en api/verify-play-purchase.js debe cambiar igual, en
// el mismo movimiento.
export const PLAY_PRODUCT_IDS = {
  monthly: 'premium_mensual',
  annual: 'premium_anual',
}

export function isAndroidBilling() {
  return typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'android'
}

let storeInitialized = false

// Registra los 2 productos y el listener permanente de aprobación —
// idempotente (una sola vez por sesión de la app, sin importar cuántas
// veces se abra/cierre PremiumPage). Se llama sola, de forma perezosa,
// desde restorePurchases() — no hace falta que App.jsx la dispare aparte.
function ensureStoreInitialized() {
  if (storeInitialized || !isAndroidBilling()) return null
  const CdvPurchase = window.CdvPurchase
  if (!CdvPurchase) return null // plugin no cargó (build sin `cap sync`, o web)
  const { store, ProductType, Platform } = CdvPurchase

  store.register([
    { id: PLAY_PRODUCT_IDS.monthly, type: ProductType.PAID_SUBSCRIPTION, platform: Platform.GOOGLE_PLAY },
    { id: PLAY_PRODUCT_IDS.annual, type: ProductType.PAID_SUBSCRIPTION, platform: Platform.GOOGLE_PLAY },
  ])

  // Verificación PROPIA contra api/verify-play-purchase.js (no el validador
  // hospedado de Fovea, que requeriría configurarlo aparte en su consola) —
  // `approved()` dispara tanto para una compra nueva como para cada una que
  // reaparezca al restaurar.
  store.when().approved((transaction) => transaction.verify())

  store.initialize([Platform.GOOGLE_PLAY])
  storeInitialized = true
  return store
}

// Envía el purchaseToken al backend para validarlo contra la Google Play
// Developer API antes de tocar profiles.is_premium — mismo patrón de Bearer
// token de sesión que api/create-checkout-session.js/manage-subscription.js.
async function verifyWithBackend({ purchaseToken, productId, accessToken }) {
  const res = await fetch('/api/verify-play-purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ purchaseToken, productId }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || 'No se pudo verificar la compra')
  return result // { isPremium, plan, subscriptionState }
}

// Dispara store.restorePurchases() y recolecta, SOLO durante esta llamada,
// las transacciones que resulten aprobadas (compras activas encontradas en
// la cuenta de Google del dispositivo) — cada una se manda a
// verify-play-purchase.js y se marca como terminada (`transaction.finish()`,
// que en Android también reconoce/confirma la compra ante Google si hiciera
// falta). Nunca tumba la restauración completa por una sola compra que no
// valide — sigue con las demás. Devuelve `{ restored: N }`, N = 0 si no se
// encontró ninguna compra activa que restaurar.
export async function restorePurchases(accessToken) {
  if (!isAndroidBilling()) {
    throw new Error('Restaurar compras solo aplica en la app de Android')
  }
  const store = ensureStoreInitialized()
  if (!store) {
    throw new Error('El sistema de compras de Google Play no está disponible')
  }

  const foundDuringRestore = []
  const collect = (transaction) => foundDuringRestore.push(transaction)
  store.when().approved(collect)

  try {
    await store.restorePurchases()
    // No hay, en todas las versiones del plugin, un evento único y
    // confiable de "la restauración terminó" — se da un margen corto para
    // que el store termine de emitir approved() por cada compra encontrada
    // antes de leer `foundDuringRestore`.
    await new Promise((resolve) => setTimeout(resolve, 1500))

    if (foundDuringRestore.length === 0) return { restored: 0 }

    let restoredCount = 0
    let lastResult = null
    for (const transaction of foundDuringRestore) {
      const product = transaction.products?.[0]
      const purchaseToken = transaction.transactionId || transaction.purchaseId
      const productId = product?.id
      if (!purchaseToken || !productId) continue
      try {
        lastResult = await verifyWithBackend({ purchaseToken, productId, accessToken })
        transaction.finish()
        restoredCount += 1
      } catch (e) {
        // Se ignora esta compra puntual (ej. ya no vigente en Google) y se
        // sigue con el resto — un error aislado no debe reportarse como
        // fallo total de la restauración.
      }
    }
    return { restored: restoredCount, result: lastResult }
  } finally {
    // El listener temporal se quita siempre, éxito o error — nunca debe
    // acumularse uno nuevo cada vez que el usuario toca "Restaurar
    // compras" varias veces en la misma sesión.
    if (typeof store.off === 'function') store.off(collect)
  }
}
