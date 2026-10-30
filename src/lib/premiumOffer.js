// Fuente única de precios, prueba gratis y promociones de Premium
// (v0.9.960–961).
//
// Principio: lo comercial NO vive en el código. Cambiar precio, días de
// prueba o lanzar una promoción se hace en la consola de cada tienda y la
// app lo refleja sin compilar ni publicar versión:
// - Android: catálogo de Google Play (`getPlayCatalog()` en playBilling.js).
// - Web: catálogo de Stripe (GET /api/create-checkout-session, que lee
//   lookup keys y metadata `trial_days`/`coupon` de cada Price).
//
// Prueba gratis UNA sola vez por cuenta de LunaPay, sin importar dónde se
// usó (Stripe o Google Play): `profiles.has_subscribed_before`. En web la
// hace cumplir el servidor; en Android se ordena la oferta sin prueba
// (playBilling.js → `allowTrial`). Además Google aplica su propia regla con
// la cuenta de Google.
//
// Mientras no llega el catálogo se muestran los últimos valores guardados
// (localStorage) o, la primera vez, FALLBACK. La prueba en Android solo se
// promete con el catálogo fresco de la sesión.
//
// App.jsx informa `has_subscribed_before` con setPremiumOfferProfile(); los
// componentes leen todo con usePremiumOffer() / usePremiumCta().

import { useEffect, useSyncExternalStore } from 'react'
import i18n from '../i18n'
import { apiUrl } from './apiUrl'
import { isAndroidBilling, getPlayCatalog } from './playBilling'

// Solo para la primera carga sin red ni caché. No es la fuente de verdad.
const FALLBACK = {
  monthly: { amount: 50, currency: 'MXN', trialDays: 7, intro: null },
  annual: { amount: 500, currency: 'MXN', trialDays: 7, intro: null },
}

const CACHE_KEY = 'lunapay-premium-catalog'
const PLANS = ['monthly', 'annual']

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null // almacenamiento bloqueado o JSON dañado: se ignora la caché
  }
}

function writeCache(catalog) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(catalog))
  } catch (e) {
    // sin almacenamiento disponible: solo se pierde la caché del siguiente arranque
  }
}

let neverSubscribed = true
let fresh = null // catálogo de esta sesión (forma normalizada, ver normalize*)
let cached
let loadPromise = null
let snapshot = null
const listeners = new Set()

function emit() {
  snapshot = null
  listeners.forEach((fn) => fn())
}

// Formato de precio con la moneda real: "$49", "$41.67", "€4.99".
export function formatPrice(amount, currency) {
  const whole = Math.abs(amount % 1) < 0.005
  try {
    return new Intl.NumberFormat(i18n.language === 'en' ? 'en-US' : 'es-MX', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch (e) {
    return `$${whole ? amount.toFixed(0) : amount.toFixed(2)}` // moneda desconocida para Intl
  }
}

// Forma normalizada: { [plan]: { withTrial, noTrial } }, cada una
// { amount, currency, trialDays, intro }.
function normalizeWeb(web) {
  const out = {}
  for (const plan of PLANS) {
    const p = web?.[plan]
    if (!p) return null
    const base = { amount: p.amount, currency: p.currency, intro: p.intro || null }
    out[plan] = { withTrial: { ...base, trialDays: p.trialDays || 0 }, noTrial: { ...base, trialDays: 0 } }
  }
  return out
}

function fallbackCatalog() {
  const out = {}
  for (const plan of PLANS) {
    out[plan] = { withTrial: FALLBACK[plan], noTrial: { ...FALLBACK[plan], trialDays: 0 } }
  }
  return out
}

function build() {
  if (cached === undefined) cached = readCache()
  const android = isAndroidBilling()
  const catalog = fresh || cached || fallbackCatalog()
  const pick = (plan) => (neverSubscribed ? catalog[plan].withTrial : catalog[plan].noTrial)
  const monthly = pick('monthly')
  const annual = pick('annual')
  const currency = monthly.currency
  const saving = Math.max(0, Math.round((monthly.amount * 12 - annual.amount) * 100) / 100)

  // En Android la prueba solo se promete con el catálogo fresco (Google
  // decide la elegibilidad de esa cuenta); en web, la caché basta porque el
  // servidor vuelve a decidir al crear el checkout.
  const trustTrial = !android || !!fresh
  const trialDays = {
    monthly: neverSubscribed && trustTrial ? monthly.trialDays : 0,
    annual: neverSubscribed && trustTrial ? annual.trialDays : 0,
  }

  const introText = (plan, offer) => {
    const intro = offer.intro
    if (!intro) return null
    const price = formatPrice(intro.amount, offer.currency)
    if (intro.cycles === 0) return i18n.t('premiumPage.introForever', { price })
    const key = intro.unit === 'year' ? 'premiumPage.introYears' : 'premiumPage.introMonths'
    return i18n.t(key, { price, count: intro.cycles })
  }

  return {
    // true mientras no llega el catálogo de esta sesión
    loading: !fresh,
    currency,
    amounts: { monthly: monthly.amount, annual: annual.amount },
    prices: { monthly: formatPrice(monthly.amount, currency), annual: formatPrice(annual.amount, currency) },
    saving: saving > 0 ? formatPrice(saving, currency) : null,
    annualPerMonth: formatPrice(annual.amount / 12, currency),
    trialDays,
    trial: { monthly: trialDays.monthly > 0, annual: trialDays.annual > 0 },
    // Para los botones que no eligen plan: la prueba más larga disponible.
    anyTrial: trialDays.monthly > 0 || trialDays.annual > 0,
    maxTrialDays: Math.max(trialDays.monthly, trialDays.annual),
    // Precio de introducción/promoción por plan, ya como texto (o null).
    intro: { monthly: introText('monthly', monthly), annual: introText('annual', annual) },
    // ¿Hay promoción en algún plan? (para los botones genéricos)
    anyIntro: !!(monthly.intro || annual.intro),
  }
}

function getSnapshot() {
  if (!snapshot) snapshot = build()
  return snapshot
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

async function fetchCatalog() {
  if (isAndroidBilling()) return getPlayCatalog()
  const res = await fetch(apiUrl('/api/create-checkout-session'), { method: 'GET' })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return normalizeWeb(await res.json())
}

// Pide el catálogo una vez por sesión.
export function loadPremiumOffer() {
  if (loadPromise) return loadPromise
  loadPromise = fetchCatalog()
    .then((catalog) => {
      if (!catalog) { loadPromise = null; return } // se reintenta en el siguiente montaje
      fresh = catalog
      cached = catalog
      writeCache(catalog)
      emit()
    })
    .catch((e) => {
      console.error('[Premium] No se pudo leer el catálogo de precios:', e)
      loadPromise = null
    })
  return loadPromise
}

export function setPremiumOfferProfile(hasSubscribedBefore) {
  const next = !hasSubscribedBefore
  if (next === neverSubscribed) return
  neverSubscribed = next
  emit()
}

export function getPremiumOffer() {
  return getSnapshot()
}

export function usePremiumOffer() {
  useEffect(() => { loadPremiumOffer() }, [])
  return useSyncExternalStore(subscribe, getSnapshot)
}

// Texto de los botones de Premium repartidos por la app (candados, banners
// de Metas, Espacio Compartido, simulador): con prueba, "Prueba Premium
// GRATIS N días" + letra pequeña con el precio real; sin prueba, "Obtener
// Premium" (y, si hay promoción, la promoción como letra pequeña).
export function usePremiumCta() {
  const offer = usePremiumOffer()
  if (offer.anyTrial) {
    return {
      cta: i18n.t('goalsPage.premiumBanner.button', { days: offer.maxTrialDays }),
      fine: i18n.t('premiumLock.finePrint', { price: offer.prices.monthly, currency: offer.currency }),
    }
  }
  return {
    cta: i18n.t('premiumLock.ctaNoTrial'),
    fine: offer.intro.monthly || offer.intro.annual || null,
  }
}
