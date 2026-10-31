import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { pickOffer, summarizeOffer } from '../src/lib/playBilling.js'

const require = createRequire(import.meta.url)
const { trialDaysOf, introFromCoupon, planOfPrice } = require('../api/_stripePrices.js')

// Fases como las entrega cordova-plugin-purchase v13 (priceMicros, billingPeriod…)
const phase = (price, period, cycles, currency = 'MXN') => ({ priceMicros: price * 1e6, billingPeriod: period, billingCycles: cycles, currency })
const base = { id: 'base', tags: [], pricingPhases: [phase(50, 'P1M', 0)] }
const trial = { id: 'trial', tags: [], pricingPhases: [phase(0, 'P7D', 1), phase(50, 'P1M', 0)] }
const promo = { id: 'promo', tags: [], pricingPhases: [phase(25, 'P1M', 3), phase(50, 'P1M', 0)] }
const hidden = { id: 'code', tags: ['lunapay-hidden'], pricingPhases: [phase(0, 'P1M', 1), phase(50, 'P1M', 0)] }

describe('Google Play: elección de oferta', () => {
  it('con derecho a prueba elige la oferta con prueba aunque Google la mande después', () => {
    expect(pickOffer({ offers: [base, trial] }).id).toBe('trial')
  })
  it('quien ya se suscribió (Stripe o Play) nunca recibe la oferta con prueba', () => {
    expect(pickOffer({ offers: [trial, base] }, { allowTrial: false }).id).toBe('base')
  })
  it('sin prueba, una promoción creada en Play Console se aplica sola', () => {
    expect(pickOffer({ offers: [base, trial, promo] }, { allowTrial: false }).id).toBe('promo')
  })
  it('si dos ofertas empiezan gratis, gana la que cobra menos después (prueba + promoción)', () => {
    const trialPromo = { id: 'launch', tags: [], pricingPhases: [phase(0, 'P7D', 1), phase(41.65, 'P1M', 3), phase(49, 'P1M', 0)] }
    expect(pickOffer({ offers: [trial, trialPromo] }).id).toBe('launch')
  })
  it('las ofertas etiquetadas lunapay-hidden no se eligen', () => {
    expect(pickOffer({ offers: [base, hidden] }).id).toBe('base')
  })
})

describe('Google Play: resumen de oferta', () => {
  it('lee precio, moneda y días de prueba de la oferta', () => {
    expect(summarizeOffer(trial)).toEqual({ amount: 50, currency: 'MXN', trialDays: 7, intro: null })
  })
  it('detecta un precio de introducción', () => {
    expect(summarizeOffer(promo).intro).toEqual({ amount: 25, unit: 'month', cycles: 3 })
  })
  it('una prueba de 2 semanas son 14 días', () => {
    const t = { pricingPhases: [phase(0, 'P2W', 1), phase(50, 'P1M', 0)] }
    expect(summarizeOffer(t).trialDays).toBe(14)
  })
})

describe('Stripe: catálogo desde el dashboard', () => {
  it('días de prueba desde la metadata del precio (7 por defecto, 0 apaga)', () => {
    expect(trialDaysOf({ metadata: {} })).toBe(7)
    expect(trialDaysOf({ metadata: { trial_days: '14' } })).toBe(14)
    expect(trialDaysOf({ metadata: { trial_days: '0' } })).toBe(0)
  })
  it('un cupón de 50 % por 3 meses se muestra como introducción', () => {
    const price = { unit_amount: 5000, currency: 'mxn', recurring: { interval: 'month' } }
    expect(introFromCoupon({ valid: true, percent_off: 50, duration: 'repeating', duration_in_months: 3 }, price))
      .toEqual({ amount: 25, unit: 'month', cycles: 3 })
  })
  it('el plan se deduce del intervalo, aunque el precio cambie', () => {
    expect(planOfPrice({ recurring: { interval: 'year' } })).toBe('annual')
    expect(planOfPrice({ recurring: { interval: 'month' } })).toBe('monthly')
  })
})

describe('Promoción en la app (variante B)', () => {
  it('calcula el % y los textos a partir del catálogo', async () => {
    const { vi } = await import('vitest')
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        monthly: { amount: 50, currency: 'MXN', trialDays: 0, intro: null },
        annual: { amount: 500, currency: 'MXN', trialDays: 0, intro: { amount: 375, unit: 'year', cycles: 1 } },
      }),
    })))
    const mod = await import('../src/lib/premiumOffer.js')
    await mod.loadPremiumOffer()
    const promo = mod.getPremiumOffer().promo
    expect(promo.monthly).toBeNull()
    expect(promo.annual.pct).toBe(25)
    expect(promo.annual.price).toBe('$375')
    expect(promo.annual.regular).toBe('$500')
    vi.unstubAllGlobals()
  })
})
