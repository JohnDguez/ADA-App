import { describe, it, expect } from 'vitest'
import { advanceAuto, dueAutoDates, firstAutoDate, paydaysUntil, suggestedPerPeriod, isSaving, hasAuto } from '../src/lib/savings'

const cfg = { cobro_freq: 'biweekly', cobro_day1: 1, cobro_day2: 16 }
const d = (y, m, day) => new Date(y, m - 1, day)

describe('savings', () => {
  it('ahorro libre = sin monto objetivo', () => {
    expect(isSaving({ target_amount: null })).toBe(true)
    expect(isSaving({ target_amount: 100 })).toBe(false)
  })
  it('primera fecha: hoy si es cobro, si no el siguiente', () => {
    expect(firstAutoDate(cfg, 'period', d(2026, 11, 16))).toBe('2026-11-16')
    expect(firstAutoDate(cfg, 'period', d(2026, 11, 17))).toBe('2026-12-01')
  })
  it('avanza por periodos, 2 periodos, semana y mes', () => {
    expect(advanceAuto(cfg, 'period', '2026-11-16')).toBe('2026-12-01')
    expect(advanceAuto(cfg, '2periods', '2026-11-16')).toBe('2026-12-16')
    expect(advanceAuto(cfg, 'week', '2026-11-16')).toBe('2026-11-23')
    expect(advanceAuto(cfg, 'month', '2026-01-31')).toBe('2026-02-28')
  })
  it('aplica los atrasados y deja la siguiente fecha futura', () => {
    const g = { auto_amount: 120, auto_every: 'period', auto_next: '2026-11-01', auto_active: true }
    const r = dueAutoDates(g, cfg, d(2026, 11, 17))
    expect(r.dates).toEqual(['2026-11-01', '2026-11-16'])
    expect(r.next).toBe('2026-12-01')
  })
  it('en pausa no aplica nada', () => {
    const g = { auto_amount: 120, auto_every: 'period', auto_next: '2026-11-01', auto_active: false }
    expect(dueAutoDates(g, cfg, d(2026, 11, 17)).dates).toEqual([])
    expect(hasAuto(g)).toBe(true)
  })
  it('sugerido solo con monto y fecha', () => {
    const g = { target_amount: 2400, current: 0, target_date: '2026-12-30' }
    expect(paydaysUntil(cfg, d(2026, 11, 16), '2026-12-30')).toBe(3)
    expect(suggestedPerPeriod(g, cfg, d(2026, 11, 16))).toBe(800)
    expect(suggestedPerPeriod({ target_amount: 2400 }, cfg, d(2026, 11, 16))).toBeNull()
    expect(suggestedPerPeriod({ target_amount: null, target_date: '2026-12-30' }, cfg, d(2026, 11, 16))).toBeNull()
  })
})
