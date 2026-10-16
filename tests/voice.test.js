import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { parseVoicePayment } from '../src/lib/parseVoicePayment'
import { getLunaState } from '../src/lib/lunaState'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 16, 10)) })
afterEach(() => vi.useRealTimers())

describe('parseVoicePayment', () => {
  it('devuelve null con texto vacío', () => {
    expect(parseVoicePayment('')).toBeNull()
    expect(parseVoicePayment(null)).toBeNull()
  })
  it('monto en palabras, fecha relativa y pagado', () => {
    const r = parseVoicePayment('pagué luz trescientos pesos ayer')
    expect(r).toMatchObject({ amount: 300, name: 'Luz', date: '2026-10-15', category: 'Servicios', paid: true })
  })
  it('"cada mes" detecta recurrente mensual', () => {
    expect(parseVoicePayment('netflix 199 pesos cada mes')).toMatchObject({ amount: 199, freq: 'monthly', category: 'Suscripciones' })
  })
  it('"a 12 meses" detecta parcialidades y no confunde el 12 con el monto', () => {
    expect(parseVoicePayment('teléfono 1200 a 12 meses')).toMatchObject({ amount: 1200, installments: 12, freq: null })
  })
  it('fecha con mes escrito', () => {
    expect(parseVoicePayment('renta 8500 el 5 de noviembre')).toMatchObject({ amount: 8500, date: '2026-11-05', category: 'Renta' })
  })
  it('categorías personalizadas tienen prioridad', () => {
    const r = parseVoicePayment('croquetas 500 pesos', { customCategories: ['Mascotas'] })
    expect(r).not.toBeNull()
    expect(typeof r.category).toBe('string')
  })
})

describe('getLunaState', () => {
  const pay = (days, extra = {}) => ({ id: String(Math.random()), due_date: `2026-10-${String(16 + days).padStart(2, '0')}`, ...extra })
  const base = { pagarEsteCobro: [], vencidos: [], delPeriodo: [], pagadosEstePeriodo: [], hour: 12 }

  it('sin pagos en el periodo: saluda', () => {
    expect(getLunaState(base).key).toBe('waving')
  })
  it('hay vencidos: preocupada (gana sobre lo demás)', () => {
    const p = pay(-2)
    expect(getLunaState({ ...base, pagarEsteCobro: [p], vencidos: [p], delPeriodo: [p] }).key).toBe('worried')
  })
  it('nada por pagar y sí hubo pagos: celebra', () => {
    expect(getLunaState({ ...base, pagadosEstePeriodo: [pay(-5)] }).key).toBe('celebrating')
  })
  it('un pospuesto no cuenta como hecho', () => {
    const s = getLunaState({ ...base, pagadosEstePeriodo: [pay(-5), pay(-4, { is_postponed: true })] })
    expect(s.done).toBe(1)
  })
  it('algo vence hoy o mañana: atenta', () => {
    const p = pay(1)
    expect(getLunaState({ ...base, pagarEsteCobro: [p], delPeriodo: [p] }).key).toBe('attentive')
  })
  it('de noche sin urgencias: dormida; de día: feliz', () => {
    const p = pay(5)
    const args = { ...base, pagarEsteCobro: [p], delPeriodo: [p] }
    expect(getLunaState({ ...args, hour: 23 }).key).toBe('sleeping')
    expect(getLunaState({ ...args, hour: 3 }).key).toBe('sleeping')
    expect(getLunaState({ ...args, hour: 14 }).key).toBe('happy')
  })
})
