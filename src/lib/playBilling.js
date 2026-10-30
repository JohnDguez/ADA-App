// Puente a Google Play Billing dentro de la app empaquetada con Capacitor
// (Android). Nunca se activa en web/PWA: ahí la pasarela es Stripe. Google
// exige Play Billing para cualquier suscripción vendida DENTRO de una app
// distribuida por Play Store.
//
// `cordova-plugin-purchase` (v13) es un plugin de Cordova: Capacitor lo
// inyecta como `window.CdvPurchase` en el WebView. Este archivo NUNCA lo
// importa (rompería el build web); lo lee en tiempo de ejecución.
//
// Principio (v0.9.961): TODO lo comercial vive en Play Console, no en el
// código. Precio, moneda, prueba gratis (y su duración), precios de
// introducción y promociones salen de las ofertas que Google devuelve para
// esa cuenta. Cambiar cualquiera de ellos no requiere compilar.

import { apiUrl } from './apiUrl'

// IDs de producto — deben coincidir con Play Console y con
// PLAN_BY_PRODUCT_ID de api/_playBilling.js.
export const PLAY_PRODUCT_IDS = {
  monthly: 'premium_mensual',
  annual: 'premium_anual',
}

// Una oferta de Play Console con esta etiqueta nunca se elige sola
// (reservada para promociones que solo se canjean con código, o para
// apagar una oferta sin borrarla).
const HIDDEN_OFFER_TAG = 'lunapay-hidden'

export function isAndroidBilling() {
  return typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'android'
}

let storeInitialized = false
let storeReadyPromise = null
let storeRef = null
let activeErrorHandler = null

// Sincronización en segundo plano (v0.9.961): ver startPlayBillingSync().
let syncAuth = null // () => Promise<string|null>  (access token de Supabase)
let syncOnVerified = null // () => void  (refrescar perfil)
const inFlight = new Map() // purchaseToken -> Promise de verificación
const VERIFIED_KEY = 'lunapay-play-verified'

function readVerified() {
  try { return new Set(JSON.parse(localStorage.getItem(VERIFIED_KEY) || '[]')) } catch (e) { return new Set() } // almacenamiento no disponible: se vuelve a verificar
}
function markVerified(token) {
  try {
    const set = readVerified()
    set.add(token)
    localStorage.setItem(VERIFIED_KEY, JSON.stringify([...set].slice(-20)))
  } catch (e) {
    // sin almacenamiento: solo implica una verificación extra en el siguiente arranque
  }
}

// El purchaseToken REAL de Google es `purchaseId`; `transactionId` es el
// orderId ("GPA.xxxx") cuando Google lo da (v0.9.959).
function purchaseTokenOf(transaction) {
  return transaction?.purchaseId || transaction?.nativePurchase?.purchaseToken || transaction?.transactionId
}

function ensureStoreInitialized() {
  if (storeInitialized) return storeRef
  if (!isAndroidBilling()) return null
  const CdvPurchase = window.CdvPurchase
  if (!CdvPurchase) return null // plugin no cargó (build sin `cap sync`)
  const { store, ProductType, Platform } = CdvPurchase

  store.register([
    { id: PLAY_PRODUCT_IDS.monthly, type: ProductType.PAID_SUBSCRIPTION, platform: Platform.GOOGLE_PLAY },
    { id: PLAY_PRODUCT_IDS.annual, type: ProductType.PAID_SUBSCRIPTION, platform: Platform.GOOGLE_PLAY },
  ])

  // En v13 los errores se registran con `store.error(cb)` una sola vez.
  store.error((err) => {
    console.error('[Google Play Billing] store.error:', err?.code, err?.message, err)
    if (typeof activeErrorHandler === 'function') activeErrorHandler(err)
  })

  // Listener PERMANENTE (v0.9.961): toda compra aprobada que aparezca —
  // comprada en la app, canjeada con un código promocional desde Play Store,
  // pendiente de pago que se completó después, o que quedó sin confirmar —
  // se verifica con el servidor y se confirma. Así el usuario no tiene que
  // tocar "Restaurar compras" para que su Premium se active.
  store.when().approved((transaction) => {
    if (!syncAuth) return // sin sesión todavía; se recoge en el siguiente arranque o al restaurar
    const token = purchaseTokenOf(transaction)
    if (!token) return
    if (transaction.isAcknowledged && readVerified().has(token)) {
      transaction.finish()
      return
    }
    verifyTransaction(transaction)
      .then(() => syncOnVerified?.())
      .catch((e) => console.error('[Google Play Billing] Verificación en segundo plano falló:', e?.message, e))
  })

  storeReadyPromise = Promise.resolve(store.initialize([Platform.GOOGLE_PLAY])).catch((e) => {
    console.error('[Google Play Billing] Error al inicializar:', e)
  })
  storeInitialized = true
  storeRef = store
  return store
}

// Lo llama App.jsx con sesión iniciada en Android: deja el store listo y
// conectado al servidor para recoger compras hechas fuera de la app.
export function startPlayBillingSync(getAccessToken, onVerified) {
  if (!isAndroidBilling()) return
  syncAuth = getAccessToken
  syncOnVerified = onVerified
  ensureStoreInitialized()
}

export function stopPlayBillingSync() {
  syncAuth = null
  syncOnVerified = null
}

export function initPlayBilling() {
  ensureStoreInitialized()
}

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

// Verifica una transacción UNA sola vez aunque la pidan a la vez el listener
// permanente, la compra en curso y "Restaurar compras".
function verifyTransaction(transaction, accessTokenOverride) {
  const purchaseToken = purchaseTokenOf(transaction)
  const productId = transaction.products?.[0]?.id
  if (!purchaseToken || !productId) return Promise.reject(new Error('Compra sin token o producto'))
  if (inFlight.has(purchaseToken)) return inFlight.get(purchaseToken)
  const p = (async () => {
    const accessToken = accessTokenOverride || (syncAuth ? await syncAuth() : null)
    if (!accessToken) throw new Error('Sin sesión para verificar la compra')
    const result = await verifyWithBackend({ purchaseToken, productId, accessToken })
    transaction.finish()
    markVerified(purchaseToken)
    return result
  })()
  inFlight.set(purchaseToken, p)
  p.finally(() => inFlight.delete(purchaseToken)).catch(() => { /* el error lo maneja quien espera la promesa */ })
  return p
}

// ── Ofertas ──────────────────────────────────────────────────────────────

function hasFreePhase(offer) {
  return !!offer?.pricingPhases?.some((ph) => Number(ph.priceMicros) === 0)
}

// "P7D" / "P1W" / "P1M" / "P1Y" → días aproximados (para la prueba).
function periodToDays(iso) {
  const m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(iso || '')
  if (!m) return 0
  const [, y, mo, w, d] = m.map((x) => Number(x) || 0)
  return y * 365 + mo * 30 + w * 7 + d
}

function periodUnit(iso) {
  if (/^P\d+Y$/.test(iso || '')) return 'year'
  if (/^P\d+M$/.test(iso || '')) return 'month'
  if (/^P\d+W$/.test(iso || '')) return 'week'
  return 'day'
}

// Lo que se cobra en el primer cobro real: fase gratis = 0, si no el precio
// de la primera fase. Sirve para elegir la oferta más conveniente.
function firstPaymentMicros(offer) {
  const first = offer?.pricingPhases?.[0]
  return first ? Number(first.priceMicros) : Infinity
}

// Elige la oferta a ordenar (v0.9.961). Google solo devuelve las ofertas
// para las que ESA cuenta califica; entre ellas se toma la más conveniente
// para el usuario (menor primer cobro), así una promoción creada en Play
// Console se aplica sola. `allowTrial=false` descarta las que traen fase
// gratis: es como se respeta que quien ya usó una prueba (en Stripe o en
// Play) no reciba otra.
export function pickOffer(product, { allowTrial = true } = {}) {
  const offers = (product?.offers || []).filter((o) => !(o.tags || []).includes(HIDDEN_OFFER_TAG))
  const pool = allowTrial ? offers : offers.filter((o) => !hasFreePhase(o))
  if (!pool.length) return null
  return [...pool].sort((a, b) => firstPaymentMicros(a) - firstPaymentMicros(b))[0]
}

// Resumen de una oferta para mostrar en la app.
export function summarizeOffer(offer) {
  const phases = offer?.pricingPhases || []
  const paid = phases.filter((ph) => Number(ph.priceMicros) > 0)
  const recurring = paid[paid.length - 1]
  if (!recurring) return null
  const free = phases.find((ph) => Number(ph.priceMicros) === 0)
  // Precio de introducción: una fase con costo, menor que el recurrente,
  // antes de él (ej. "3 meses a $25").
  const intro = paid.length > 1 && Number(paid[0].priceMicros) < Number(recurring.priceMicros)
    ? {
        amount: Number(paid[0].priceMicros) / 1e6,
        unit: periodUnit(paid[0].billingPeriod),
        cycles: Number(paid[0].billingCycles) || 1,
      }
    : null
  return {
    amount: Number(recurring.priceMicros) / 1e6,
    currency: recurring.currency || 'MXN',
    trialDays: free ? periodToDays(free.billingPeriod) * (Number(free.billingCycles) || 1) : 0,
    intro,
  }
}

async function getProductWithRetry(store, productId) {
  const { Platform } = window.CdvPurchase
  if (storeReadyPromise) await storeReadyPromise
  for (let i = 0; i < 10; i++) {
    const product = store.get(productId, Platform.GOOGLE_PLAY)
    if (product?.offers?.length) return product
    try { await store.update() } catch (e) { /* se reintenta en la siguiente vuelta */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  return null
}

// Catálogo real de Google Play PARA ESTA cuenta, con las dos variantes por
// plan: la que se ofrece a quien nunca se ha suscrito (`withTrial`) y la que
// se ofrece a quien ya lo hizo (`noTrial`, sin fase gratis). premiumOffer.js
// elige según `has_subscribed_before`. null si el catálogo no cargó.
export async function getPlayCatalog() {
  if (!isAndroidBilling()) return null
  const store = ensureStoreInitialized()
  if (!store) return null
  const result = {}
  for (const [plan, productId] of Object.entries(PLAY_PRODUCT_IDS)) {
    const product = await getProductWithRetry(store, productId)
    const withTrial = summarizeOffer(pickOffer(product, { allowTrial: true }))
    const noTrial = summarizeOffer(pickOffer(product, { allowTrial: false }))
    if (!withTrial || !noTrial) return null
    result[plan] = { withTrial, noTrial }
  }
  return result
}

// ── Compra y restauración ────────────────────────────────────────────────

// `allowTrial`: false si la cuenta de LunaPay ya tuvo una suscripción (en
// Stripe o en Play). Google decide su propia elegibilidad con el historial
// de la cuenta de Google, pero no sabe nada de Stripe: aquí se cierra ese
// hueco ordenando la oferta sin prueba.
export async function purchasePremium(plan, accessToken, userId, { allowTrial = true } = {}) {
  if (!isAndroidBilling()) throw new Error('La compra por Google Play solo aplica en la app de Android')
  const store = ensureStoreInitialized()
  if (!store) throw new Error('El sistema de compras de Google Play no está disponible')
  const productId = PLAY_PRODUCT_IDS[plan]
  // Liga la compra a ESTE usuario (auditoría v0.9.713): Google la guarda
  // como obfuscatedExternalAccountId y el servidor rechaza que otra cuenta
  // la reclame.
  if (userId) {
    store.obfuscator = 'disabled'
    store.applicationUsername = () => userId
  }
  const offer = pickOffer(await getProductWithRetry(store, productId), { allowTrial })
  if (!offer) {
    throw new Error('No se encontró el plan "' + productId + '" en Google Play (¿producto/oferta activos y cuenta de prueba con acceso?)')
  }

  return new Promise((resolve, reject) => {
    let settled = false
    function cleanup() {
      if (typeof store.off === 'function') store.off(onApproved)
      activeErrorHandler = null
    }
    const onApproved = async (transaction) => {
      if (settled || transaction.products?.[0]?.id !== productId) return
      settled = true
      cleanup()
      try {
        resolve(await verifyTransaction(transaction, accessToken))
      } catch (e) {
        reject(e)
      }
    }
    const onError = (err) => {
      if (settled) return
      settled = true
      cleanup()
      console.error('[Google Play Billing] Error de compra:', err?.code, err?.message, err)
      const wrapped = new Error(err?.message || 'No se pudo completar la compra')
      wrapped.code = err?.code
      reject(wrapped)
    }
    store.when().approved(onApproved)
    activeErrorHandler = onError
    // En v13 `order()` resuelve con el error (o undefined), no rechaza.
    store.order(offer).then((err) => { if (err) onError(err) }).catch(onError)
  })
}

// Busca compras activas de la cuenta de Google y las verifica. Devuelve
// `{ restored: N }`; lanza error si Google sí tenía compras pero ninguna
// se pudo verificar.
export async function restorePurchases(accessToken) {
  if (!isAndroidBilling()) throw new Error('Restaurar compras solo aplica en la app de Android')
  const store = ensureStoreInitialized()
  if (!store) throw new Error('El sistema de compras de Google Play no está disponible')

  const found = []
  const collect = (transaction) => found.push(transaction)
  store.when().approved(collect)

  try {
    if (storeReadyPromise) await storeReadyPromise
    await store.restorePurchases()

    const { TransactionState } = window.CdvPurchase
    const collectLocal = () => {
      const seen = new Set(found.map(purchaseTokenOf))
      for (const t of store.localTransactions || []) {
        const id = purchaseTokenOf(t)
        if (t.state === TransactionState.APPROVED && id && !seen.has(id)) {
          seen.add(id)
          found.push(t)
        }
      }
    }
    for (let i = 0; i < 6; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      collectLocal()
      if (found.length > 0) break
    }
    if (found.length === 0) return { restored: 0 }

    let restoredCount = 0
    let lastResult = null
    let lastError = null
    for (const transaction of found) {
      try {
        lastResult = await verifyTransaction(transaction, accessToken)
        restoredCount += 1
      } catch (e) {
        console.error('[Google Play Billing] Error verificando una compra durante restorePurchases:', purchaseTokenOf(transaction), e?.message, e)
        lastError = e
      }
    }
    if (restoredCount === 0 && lastError) throw lastError
    return { restored: restoredCount, result: lastResult }
  } finally {
    if (typeof store.off === 'function') store.off(collect)
  }
}
