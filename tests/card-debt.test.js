import { describe, it, expect } from 'vitest'
import { debtBreakdown } from '../src/lib/cardPlans.js'

// Tarjeta con un plan a meses de 9,800 (6 cuotas) sin facturar aún.
const card = { plans: [{ id: 'p1', n: 6, total: 9800, cuota: 1633.33, charged: 0, paid: 0, start: '2026-11-01' }] }

describe('debtBreakdown · crédito a favor', () => {
  it('sin abonos: debe lo gastado más el plan', () => {
    const d = debtBreakdown({ statement: 0, cycleSpend: 245, carry: 0, card })
    expect(d.total).toBe(10045)
  })
  it('un abono de 2,000 cubre el gasto y el sobrante baja el plan', () => {
    const d = debtBreakdown({ statement: 0, cycleSpend: 245, carry: -2000, card })
    expect(d.cycle).toBe(0)
    expect(d.total).toBe(8045)
  })
  it('un crédito mayor que todo lo que se debe deja $0, nunca negativo', () => {
    expect(debtBreakdown({ statement: 0, cycleSpend: 0, carry: -50000, card }).total).toBe(0)
  })
})

// v0.9.1013: desglose para la pantalla (brutos + abono aplicado)
it('desglose: abono 2000 cubre gastos 245 y baja el plan', () => {
  const d = debtBreakdown({ statement: 0, cycleSpend: 245, carry: -2000, card })
  expect(d.cycleGross).toBe(245)
  expect(d.plansGross).toBe(9800)
  expect(d.abonosApplied).toBe(2000)
  expect(d.planCredit).toBe(1755)
  expect(d.total).toBe(8045)
  expect(d.favor).toBe(0)
})

it('reparte el abono por cuotas: 1,920 llena la 1 y 17.6% de la 2', async () => {
  const { planCreditAlloc } = await import('../src/lib/cardPlans.js')
  const a = planCreditAlloc(card, 1920).p1
  expect(a.covered).toBe(1920)
  expect(a.fills[0]).toBe(1)
  expect(a.fills[1]).toBeCloseTo(286.67 / 1633.33, 3)
  expect(a.fills[2]).toBe(0)
})
