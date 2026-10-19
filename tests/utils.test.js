import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { dateToStr, dateOf, clampedDate, nextPeriodDate, cobroPeriod, nextCobroPeriod, fmt, getPremiumSource, monthlyEquivalent } from '../src/lib/utils'
import { getCurrency, setActiveCurrency, getCurrencySymbol } from '../src/lib/currency'
import { formatBadgeCount } from '../src/lib/formatBadgeCount'

// "Hoy" fijo: viernes 16 de octubre de 2026, 10:00 hora local.
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 16, 10)) })
afterEach(() => { vi.useRealTimers(); setActiveCurrency('MXN') })

const span = p => [dateToStr(p.start), dateToStr(p.end), p.nextCobro && dateToStr(p.nextCobro)]

describe('fechas', () => {
  it('dateOf/dateToStr son inversas y usan fecha local', () => {
    expect(dateToStr(dateOf('2026-02-28'))).toBe('2026-02-28')
  })
  it('clampedDate ajusta el día 31 al último del mes corto', () => {
    expect(dateToStr(clampedDate(2026, 1, 31))).toBe('2026-02-28')
    expect(dateToStr(clampedDate(2028, 1, 31))).toBe('2028-02-29')
    expect(dateToStr(clampedDate(2026, 3, 31))).toBe('2026-04-30')
  })
  it('clampedDate normaliza meses fuera de rango', () => {
    expect(dateToStr(clampedDate(2026, -1, 15))).toBe('2025-12-15')
    expect(dateToStr(clampedDate(2026, 12, 15))).toBe('2027-01-15')
  })
  it('nextPeriodDate avanza según la frecuencia', () => {
    expect(dateToStr(nextPeriodDate('2026-10-16', 'weekly'))).toBe('2026-10-23')
    expect(dateToStr(nextPeriodDate('2026-10-16', 'biweekly'))).toBe('2026-10-30')
    expect(dateToStr(nextPeriodDate('2026-10-16', 'quarterly'))).toBe('2027-01-16')
  })
})

describe('periodo de cobro', () => {
  it('quincenal 1 y 16: hoy es día de cobro y empieza periodo nuevo', () => {
    const cfg = { cobro_freq: 'biweekly', cobro_day1: 1, cobro_day2: 16 }
    expect(span(cobroPeriod(cfg))).toEqual(['2026-10-16', '2026-10-31', '2026-11-01'])
    const nx = nextCobroPeriod(cfg)
    expect([dateToStr(nx.start), dateToStr(nx.end)]).toEqual(['2026-11-01', '2026-11-15'])
  })
  it('quincenal con los días al revés da el mismo resultado', () => {
    const a = cobroPeriod({ cobro_freq: 'biweekly', cobro_day1: 16, cobro_day2: 1 })
    expect(span(a)).toEqual(['2026-10-16', '2026-10-31', '2026-11-01'])
  })
  it('mensual con día 31 cae al último día de los meses cortos', () => {
    expect(span(cobroPeriod({ cobro_freq: 'monthly', cobro_day1: 31 }))).toEqual(['2026-09-30', '2026-10-30', '2026-10-31'])
  })
  it('semanal: el periodo dura 7 días', () => {
    expect(span(cobroPeriod({ cobro_freq: 'weekly', cobro_weekday: 5 }))).toEqual(['2026-10-16', '2026-10-22', '2026-10-23'])
  })
  it('un refDate distinto ubica el periodo que contiene esa fecha', () => {
    const p = cobroPeriod({ cobro_freq: 'biweekly', cobro_day1: 1, cobro_day2: 16 }, new Date(2026, 11, 20))
    expect(span(p)).toEqual(['2026-12-16', '2026-12-31', '2027-01-01'])
  })
})

describe('montos y monedas', () => {
  it('fmt usa 2 decimales, separador de miles y signo', () => {
    expect(fmt(1234.5)).toBe('$1,234.50')
    expect(fmt(-50)).toBe('-$50.00')
    expect(fmt('0')).toBe('$0.00')
  })
  it('la moneda activa cambia el símbolo, no el formato', () => {
    setActiveCurrency('USD')
    expect(getCurrencySymbol()).toBe('US$')
    expect(fmt(10)).toBe('US$10.00')
  })
  it('getCurrency cae a MXN con códigos desconocidos o vacíos', () => {
    expect(getCurrency('XXX').code).toBe('MXN')
    expect(getCurrency(null).code).toBe('MXN')
    expect(getCurrency({ currency: 'PEN' }).symbol).toBe('S/')
  })
  it('formatBadgeCount topa en 99+', () => {
    expect(formatBadgeCount(0)).toBe('0')
    expect(formatBadgeCount(99)).toBe('99')
    expect(formatBadgeCount(100)).toBe('99+')
  })
})

describe('getPremiumSource', () => {
  it('none si no es premium', () => {
    expect(getPremiumSource(null)).toBe('none')
    expect(getPremiumSource({ is_premium: false, stripe_subscription_id: 'sub_1' })).toBe('none')
  })
  it('stripe y google_play exigen plataforma E id de suscripción/token', () => {
    expect(getPremiumSource({ is_premium: true, subscription_platform: 'stripe', stripe_subscription_id: 'sub_1' })).toBe('stripe')
    expect(getPremiumSource({ is_premium: true, subscription_platform: 'google_play', google_play_purchase_token: 'tok' })).toBe('google_play')
  })
  it('premium sin suscripción real = admin (otorgado a mano)', () => {
    expect(getPremiumSource({ is_premium: true })).toBe('admin')
    expect(getPremiumSource({ is_premium: true, subscription_platform: 'google_play' })).toBe('admin')
  })
})

describe('monthlyEquivalent', () => {
  it('prorratea cada frecuencia a su equivalente mensual', () => {
    const m = (recur_freq, amount = 1200) => monthlyEquivalent({ recur_freq, amount })
    expect(m('monthly')).toBe(1200)
    expect(m('weekly')).toBeCloseTo(1200 * 52 / 12)
    expect(m('biweekly')).toBeCloseTo(1200 * 26 / 12)
    expect(m('bimonthly')).toBe(600)
    expect(m('quarterly')).toBe(400)
    expect(m('semiannual')).toBe(200)
    expect(m('annual')).toBe(100)
  })
  it('pausados y variables no cuentan', () => {
    expect(monthlyEquivalent({ recur_freq: 'monthly', amount: 500, paused: true })).toBe(0)
    expect(monthlyEquivalent({ recur_freq: 'monthly', amount: 500, is_variable: true })).toBe(0)
  })
})
