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

import { apiUrl } from './apiUrl'

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
let storeReadyPromise = null

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

  // `initialize()` es asíncrono: el catálogo de productos (precios, ofertas)
  // llega DESPUÉS. Se guarda la promesa para poder esperarla antes de ordenar —
  // antes la primera compra pedía la oferta apenas se inicializaba el store,
  // cuando todavía no cargaba, y fallaba con "plan no encontrado".
  storeReadyPromise = Promise.resolve(store.initialize([Platform.GOOGLE_PLAY])).catch((e) => {
    console.error('[Google Play Billing] Error al inicializar:', e)
  })
  storeInitialized = true
  return store
}

// Se llama al abrir PremiumPage en Android para que el catálogo ya esté
// cargado cuando el usuario toque "Comprar".
export function initPlayBilling() {
  ensureStoreInitialized()
}

// Envía el purchaseToken al backend para validarlo contra la Google Play
// Developer API antes de tocar profiles.is_premium — mismo patrón de Bearer
// token de sesión que api/create-checkout-session.js/manage-subscription.js.
async function verifyWithBackend({ purchaseToken, productId, accessToken }) {
  const res = await fetch(apiUrl('/api/verify-play-purchase'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ purchaseToken, productId }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || 'No se pudo verificar la compra')
  return result // { isPremium, plan, subscriptionState }
}

// Dispara una compra NUEVA de Google Play Billing para el plan indicado —
// contraparte de restorePurchases() (esa es para una compra que YA existía
// en la cuenta de Google). NUEVO — cierra el hueco real encontrado al
// probar en vivo (v0.9.527): PremiumPage.jsx llamaba SIEMPRE a Stripe
// (startCheckout), incluso dentro de la app de Android — el checkout
// embebido de Stripe no carga en el WebView empaquetado ("Couldn't load
// the payment form") y, más grave, viola la política de Google Play (ver
// CONTEXT.md, "Google exige Play Billing para cualquier suscripción
// vendida DENTRO de una app distribuida por Play Store"). Toma la oferta
// del producto tal cual la devuelve Google (incluye la prueba de 7 días
// cuando el usuario todavía califica para ella — Google decide eso solo,
// no hace falta pedir un offerId específico) y la ordena.
export async function purchasePremium(plan, accessToken) {
  if (!isAndroidBilling()) {
    throw new Error('La compra por Google Play solo aplica en la app de Android')
  }
  const store = ensureStoreInitialized()
  if (!store) {
    throw new Error('El sistema de compras de Google Play no está disponible')
  }
  const { Platform } = window.CdvPurchase
  const productId = PLAY_PRODUCT_IDS[plan]
  if (storeReadyPromise) await storeReadyPromise
  // Reintenta unos segundos: el catálogo puede tardar en llegar de Google.
  let offer = null
  for (let i = 0; i < 10; i++) {
    offer = store.get(productId, Platform.GOOGLE_PLAY)?.getOffer()
    if (offer) break
    try { await store.update() } catch (e) { /* se reintenta */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  if (!offer) {
    throw new Error('No se encontró el plan "' + productId + '" en Google Play (¿producto/oferta activos y cuenta de prueba con acceso?)')
  }

  return new Promise((resolve, reject) => {
    let settled = false
    function cleanup() {
      if (typeof store.off === 'function') { store.off(onApproved); store.off(onError) }
    }
    const onApproved = async (transaction) => {
      // El store puede tener más de una transacción viva (ej. una compra
      // vieja sin terminar) — nos quedamos solo con la del producto que
      // este usuario acaba de ordenar, cualquier otra la ignora este
      // listener puntual (restorePurchases() ya se encarga de las demás).
      if (settled || transaction.products?.[0]?.id !== productId) return
      settled = true
      cleanup()
      try {
        const purchaseToken = transaction.transactionId || transaction.purchaseId
        const result = await verifyWithBackend({ purchaseToken, productId, accessToken })
        transaction.finish()
        resolve(result)
      } catch (e) {
        reject(e)
      }
    }
    const onError = (err) => {
      if (settled) return
      settled = true
      cleanup()
      // Mismo criterio que nativeGoogleAuth.js (v0.9.536): loggear el error
      // REAL de Google Play antes de envolverlo en un mensaje genérico — sin
      // esto, "Couldn't complete the purchase" no dice si la causa es un
      // producto no encontrado/no aprobado en Play Console, el comprador de
      // prueba sin acceso a ese track, "item already owned", o algo más.
      // Visible en Logcat/Android Studio (tag `Capacitor/Console`) o en
      // remote debugging (chrome://inspect) con el dispositivo conectado.
      console.error('[Google Play Billing] Error de compra:', err?.code, err?.message, err)
      const wrapped = new Error(err?.message || 'No se pudo completar la compra')
      wrapped.code = err?.code
      reject(wrapped)
    }
    store.when().approved(onApproved)
    store.when().error(onError)
    store.order(offer).catch(onError)
  })
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
        // fallo total de la restauración. Sí se loggea (mismo criterio que
        // onError de purchasePremium más arriba) para poder ver, por
        // ejemplo, si lo que está fallando en realidad es la llamada al
        // backend (verify-play-purchase.js) y no la restauración en sí.
        console.error('[Google Play Billing] Error verificando una compra durante restorePurchases:', purchaseToken, e?.message, e)
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
