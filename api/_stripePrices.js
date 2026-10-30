// Catálogo de Premium en Stripe (v0.9.961) — fuente única para el web.
//
// Principio: lo comercial se cambia en el dashboard de Stripe, no en código
// ni en variables de entorno.
//
// - Precio: cada plan se busca primero por `lookup_key`
//   (`lunapay_premium_monthly` / `lunapay_premium_annual`). Para cambiar el
//   precio se crea un Price nuevo en Stripe con esa lookup key y la opción
//   "transferir lookup key" — sin tocar Vercel. Si no hay lookup key, se usa
//   la variable de entorno de siempre (STRIPE_PRICE_MONTHLY/ANNUAL).
// - Prueba gratis: metadata `trial_days` del Price (número de días; "0"
//   apaga la prueba). Sin metadata: 7 días.
// - Promoción automática: metadata `coupon` del Price con el id de un cupón
//   de Stripe — se aplica sola en el checkout y la app la muestra. Sin
//   cupón, el checkout acepta códigos promocionales creados en Stripe.
//
// Prefijo `_`: no cuenta contra el límite de 12 funciones de Vercel.

const LOOKUP_KEYS = {
  monthly: 'lunapay_premium_monthly',
  annual: 'lunapay_premium_annual',
}
const ENV_PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_MONTHLY,
  annual: process.env.STRIPE_PRICE_ANNUAL,
}
const DEFAULT_TRIAL_DAYS = 7
const CACHE_MS = 5 * 60 * 1000

let cache = null
let cacheAt = 0

function trialDaysOf(price) {
  const raw = price?.metadata?.trial_days
  if (raw === undefined || raw === null || raw === '') return DEFAULT_TRIAL_DAYS
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

// Cupón → precio de introducción para mostrar ({amount, unit, cycles}).
function introFromCoupon(coupon, price) {
  if (!coupon || !coupon.valid) return null
  const base = price.unit_amount / 100
  let amount = base
  if (coupon.percent_off) amount = base * (1 - coupon.percent_off / 100)
  else if (coupon.amount_off && (!coupon.currency || coupon.currency === price.currency)) amount = Math.max(0, base - coupon.amount_off / 100)
  if (amount >= base) return null
  const unit = price.recurring?.interval === 'year' ? 'year' : 'month'
  let cycles = 1
  if (coupon.duration === 'repeating' && coupon.duration_in_months) {
    cycles = unit === 'year' ? Math.max(1, Math.round(coupon.duration_in_months / 12)) : coupon.duration_in_months
  } else if (coupon.duration === 'forever') {
    return { amount: Math.round(amount * 100) / 100, unit, cycles: 0 } // 0 = para siempre
  }
  return { amount: Math.round(amount * 100) / 100, unit, cycles }
}

async function loadCatalog(stripe) {
  if (cache && Date.now() - cacheAt < CACHE_MS) return cache
  const byLookup = {}
  try {
    const list = await stripe.prices.list({ lookup_keys: Object.values(LOOKUP_KEYS), active: true, limit: 10 })
    for (const p of list.data) byLookup[p.lookup_key] = p
  } catch (e) {
    console.error('[stripePrices] No se pudieron buscar precios por lookup_key:', e.message)
  }
  const result = {}
  for (const plan of Object.keys(LOOKUP_KEYS)) {
    let price = byLookup[LOOKUP_KEYS[plan]]
    if (!price && ENV_PRICE_IDS[plan]) price = await stripe.prices.retrieve(ENV_PRICE_IDS[plan])
    if (!price) throw new Error(`No hay precio de Stripe para el plan ${plan}`)
    let coupon = null
    if (price.metadata?.coupon) {
      try { coupon = await stripe.coupons.retrieve(price.metadata.coupon) } catch (e) {
        console.error('[stripePrices] Cupón inválido en metadata del precio:', price.metadata.coupon, e.message)
      }
    }
    result[plan] = {
      priceId: price.id,
      amount: price.unit_amount / 100,
      currency: (price.currency || 'mxn').toUpperCase(),
      trialDays: trialDaysOf(price),
      couponId: coupon?.valid ? coupon.id : null,
      intro: introFromCoupon(coupon, price),
    }
  }
  cache = result
  cacheAt = Date.now()
  return result
}

// Plan de un Price cualquiera (también de precios viejos que ya no tienen la
// lookup key): por el intervalo de cobro.
function planOfPrice(price) {
  if (price?.recurring?.interval === 'year') return 'annual'
  if (price?.recurring?.interval === 'month') return 'monthly'
  return null
}

// Lo que se puede mostrar en público (sin ids internos).
function publicCatalog(catalog) {
  const out = {}
  for (const [plan, c] of Object.entries(catalog)) {
    out[plan] = { amount: c.amount, currency: c.currency, trialDays: c.trialDays, intro: c.intro }
  }
  return out
}

module.exports = { loadCatalog, planOfPrice, publicCatalog, trialDaysOf, introFromCoupon }
