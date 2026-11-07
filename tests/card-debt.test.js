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
