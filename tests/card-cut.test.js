import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computeMissingStatements, currentCycleSpend, cardsCuttingInPeriod, upcomingCut, cardDebt } from '../src/lib/cardStatements'
import { dateOf, dateToStr, nextWeeklyFromDate } from '../src/lib/utils'

// Hoy fijo: domingo 18 de octubre de 2026 (día de corte de la tarjeta de prueba).
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 18, 9)) })
afterEach(() => { vi.useRealTimers() })

const card = (over = {}) => ({
  id: 'c1', kind: 'credit', cut_day: 18, due_day: 5, carry_over: 0, plans: [],
  last_statement_cut: '2026-09-18', created_at: '2026-01-01T12:00:00.000Z', ...over,
})
// Pago pagado con la tarjeta, fechado en `day` (mediodía local).
const pay = (day, amount) => ({ paid_at: new Date(`${day}T12:00:00`).toISOString(), due_date: day, amount })
const todayDate = () => dateOf('2026-10-18')

describe('corte de tarjeta: el día del corte pertenece al ciclo siguiente', () => {
  it('genera el estado de cuenta al iniciar el día de corte', () => {
    const cycles = computeMissingStatements(card(), [pay('2026-10-10', 500)], todayDate())
    expect(cycles).toHaveLength(1)
    expect(cycles[0].cycleEnd).toBe('2026-10-18')
    expect(cycles[0].amount).toBe(500)
  })

  it('lo gastado el mismo día del corte NO entra a ese estado de cuenta', () => {
    const cycles = computeMissingStatements(card(), [pay('2026-10-10', 500), pay('2026-10-18', 300)], todayDate())
    expect(cycles[0].amount).toBe(500)
  })

  it('lo gastado el día del corte cuenta en el ciclo en curso (siguiente corte)', () => {
    const after = card({ last_statement_cut: '2026-10-18' })
    expect(currentCycleSpend(after, [pay('2026-10-18', 300), pay('2026-10-17', 999)])).toBe(300)
  })

  it('el día después de un corte ya facturado no se vuelve a facturar', () => {
    const after = card({ last_statement_cut: '2026-10-18' })
    expect(computeMissingStatements(after, [pay('2026-10-18', 300)], todayDate())).toHaveLength(0)
  })

  it('un día antes del corte todavía no se genera', () => {
    vi.setSystemTime(new Date(2026, 9, 17, 9))
    expect(computeMissingStatements(card(), [pay('2026-10-10', 500)], dateOf('2026-10-17'))).toHaveLength(0)
  })

  it('tarjeta nueva: lo pagado el día de alta cuenta en su primer ciclo', () => {
    const fresh = card({ last_statement_cut: null, created_at: new Date(2026, 9, 1, 12).toISOString() })
    const cycles = computeMissingStatements(fresh, [pay('2026-10-01', 120)], todayDate())
    expect(cycles[0].amount).toBe(120)
  })
})

describe('recordatorio de corte', () => {
  it('upcomingCut cuenta hoy como próximo corte', () => {
    expect(dateToStr(upcomingCut(card(), todayDate()))).toBe('2026-10-18')
    expect(dateToStr(upcomingCut(card({ cut_day: 17 }), todayDate()))).toBe('2026-11-17')
  })

  it('lista solo las tarjetas con corte dentro del periodo, la más próxima primero', () => {
    const cards = [
      card({ id: 'a', cut_day: 20 }),
      card({ id: 'b', cut_day: 18 }),
      card({ id: 'c', cut_day: 3 }),
      { ...card({ id: 'd', cut_day: 19 }), kind: 'debit' },
    ]
    const res = cardsCuttingInPeriod(cards, todayDate(), dateOf('2026-10-22'))
    expect(res.map(r => r.card.id)).toEqual(['b', 'a'])
    expect(res.map(r => r.daysLeft)).toEqual([0, 2])
  })

  it('sin tarjetas con corte en el periodo, la lista queda vacía', () => {
    expect(cardsCuttingInPeriod([card({ cut_day: 3 })], todayDate(), dateOf('2026-10-22'))).toEqual([])
  })

  it('incluye el vencimiento del pago (siguiente día de pago tras el corte)', () => {
    const res = cardsCuttingInPeriod([card({ id: 'b', cut_day: 18, due_day: 5 })], todayDate(), dateOf('2026-10-22'))
    expect(dateToStr(res[0].dueDate)).toBe('2026-11-05')
  })
})

describe('semanal con fecha de inicio', () => {
  it('fecha futura: esa es la primera; pasada: avanza de 7 en 7', () => {
    expect(dateToStr(nextWeeklyFromDate('2026-10-26'))).toBe('2026-10-26')
    expect(dateToStr(nextWeeklyFromDate('2026-10-05'))).toBe('2026-10-19')
  })
})

describe('por pagar: compra del día del corte, después de pagar el estado de cuenta', () => {
  const after = card({ last_statement_cut: '2026-10-18' })
  const stmt = { card_statement_for: 'c1', is_card_statement: true, is_paid: true, amount: 1010.1, paid_at: new Date(2026, 9, 18, 9).toISOString() }
  const refl = (over = {}) => ({ ...pay('2026-10-18', 1000), payment_method_id: 'c1', payment_method_kind: 'credit', is_paid: true, ...over })

  it('suma los $1,000 al ciclo siguiente (estado pagado, sin arrastre)', () => {
    expect(cardDebt(after, [stmt, refl()]).total).toBe(1000)
  })
  it('un reflejo sin tipo "credit" NO cuenta como deuda (síntoma del reporte)', () => {
    expect(cardDebt(after, [stmt, refl({ payment_method_kind: 'cash' })]).total).toBe(0)
  })
  it('un arrastre negativo de -1000 se come la compra', () => {
    expect(cardDebt({ ...after, carry_over: -1000 }, [stmt, refl()]).total).toBe(0)
  })
})
