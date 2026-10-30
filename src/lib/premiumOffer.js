// Fuente única de precios y de prueba gratis de Premium (v0.9.960).
//
// Antes los precios ($50/$500, ahorro $100 · $41.67) y el "7 días gratis"
// estaban escritos a mano en PremiumPage, SettingsSubscriptionPage, App.jsx
// y en cada botón de Premium de la app. En Android eso tenía dos problemas:
// (1) cambiar el precio en Play Console exigía compilar y publicar una
// versión nueva, y (2) los botones prometían la prueba aunque Google ya no
// la ofreciera a esa cuenta (Google decide la elegibilidad con su propio
// historial).
//
// Ahora:
// - Android: precio, moneda y prueba vienen del catálogo de Google Play
//   (`getPlayCatalog()`), con la última lectura guardada en localStorage
//   para mostrar algo al instante en el siguiente arranque. La prueba solo se
//   anuncia con el catálogo FRESCO de esta sesión, nunca desde la caché.
// - Web (Stripe): precios fijos de abajo (WEB_PRICES); la prueba depende de
//   `profiles.has_subscribed_before`, igual que create-checkout-session.js.
//
// App.jsx informa `has_subscribed_before` con setPremiumOfferProfile(); los
// componentes leen todo con el hook usePremiumOffer().

import { useEffect, useSyncExternalStore } from 'react'
import i18n from '../i18n'
import { isAndroidBilling, getPlayCatalog } from './playBilling'

// Precios de Stripe (web). Si cambian en Stripe, se cambian aquí y en ningún
// otro archivo.
export const WEB_PRICES = { currency: 'MXN', monthly: 50, annual: 500 }

const CACHE_KEY = 'lunapay-play-catalog'

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
let freshCatalog = null
let cachedCatalog = null
let cacheRead = false
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

function build() {
  const android = isAndroidBilling()
  if (android && !cacheRead) {
    cachedCatalog = readCache()
    cacheRead = true
  }
  const catalog = android ? (freshCatalog || cachedCatalog) : null
  const currency = catalog?.monthly?.currency || WEB_PRICES.currency
  const monthly = catalog?.monthly?.amount ?? WEB_PRICES.monthly
  const annual = catalog?.annual?.amount ?? WEB_PRICES.annual
  const saving = Math.max(0, Math.round((monthly * 12 - annual) * 100) / 100)

  const trial = {
    monthly: neverSubscribed && (!android || !!freshCatalog?.monthly?.hasTrial),
    annual: neverSubscribed && (!android || !!freshCatalog?.annual?.hasTrial),
  }

  return {
    // true en Android mientras no llega el catálogo de esta sesión
    loading: android && !freshCatalog,
    currency,
    amounts: { monthly, annual },
    prices: { monthly: formatPrice(monthly, currency), annual: formatPrice(annual, currency) },
    saving: saving > 0 ? formatPrice(saving, currency) : null,
    annualPerMonth: formatPrice(annual / 12, currency),
    trial,
    // Para los botones que no eligen plan: se promete la prueba solo si
    // algún plan la tiene.
    anyTrial: trial.monthly || trial.annual,
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

// Pide el catálogo a Google una vez por sesión (solo Android).
export function loadPremiumOffer() {
  if (!isAndroidBilling() || loadPromise) return loadPromise
  loadPromise = getPlayCatalog()
    .then((catalog) => {
      if (!catalog) { loadPromise = null; return } // se reintenta en el siguiente montaje
      freshCatalog = catalog
      writeCache(catalog)
      emit()
    })
    .catch((e) => {
      console.error('[Premium] No se pudo leer el catálogo de Google Play:', e)
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
// de Metas, Espacio Compartido, simulador): con prueba disponible, "Prueba
// Premium GRATIS 7 días" + letra pequeña con el precio real; sin prueba,
// "Obtener Premium" y sin letra pequeña.
export function usePremiumCta() {
  const offer = usePremiumOffer()
  return {
    cta: offer.anyTrial ? i18n.t('goalsPage.premiumBanner.button') : i18n.t('premiumLock.ctaNoTrial'),
    fine: offer.anyTrial ? i18n.t('premiumLock.finePrint', { price: offer.prices.monthly, currency: offer.currency }) : null,
  }
}
