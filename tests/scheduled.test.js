import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/lib/supabase', () => ({ supabase: {} }))
import { getScheduled, groupByMonth, usesRecurring } from '../src/lib/scheduled'
import { today, dateToStr, addDays } from '../src/lib/utils'

const profile = { cobro_freq: 'weekly', cobro_weekday: 5 }
const inDays = n => dateToStr(addDays(today(), n))
const base = { is_master: false, parent_id: null, is_paid: false, is_postponed: false }

describe('getScheduled', () => {
  it('incluye únicos pendientes posteriores al periodo y los ordena', () => {
    const list = getScheduled([
      { ...base, id: 'b', due_date: inDays(60), amount: 10 },
      { ...base, id: 'a', due_date: inDays(30), amount: 5 },
    ], profile)
    expect(list.map(p => p.id)).toEqual(['a', 'b'])
  })
  it('excluye pagados, pospuestos, recurrentes, parcialidades y masters', () => {
    const due = inDays(40)
    const list = getScheduled([
      { ...base, id: 'paid', due_date: due, is_paid: true },
      { ...base, id: 'post', due_date: due, is_postponed: true },
      { ...base, id: 'rec', due_date: due, is_recurrent: true, parent_id: 'm' },
      { ...base, id: 'inst', due_date: due, is_installment: true },
      { ...base, id: 'master', due_date: due, is_master: true },
    ], profile)
    expect(list).toEqual([])
  })
  it('excluye lo que cae dentro del periodo actual', () => {
    expect(getScheduled([{ ...base, id: 'x', due_date: inDays(0) }], profile)).toEqual([])
  })
})

describe('groupByMonth', () => {
  it('agrupa por mes y suma sin contar pospuestos', () => {
    const g = groupByMonth([
      { due_date: '2027-01-10', amount: 100 },
      { due_date: '2027-01-20', amount: 50, is_postponed: true },
      { due_date: '2027-02-01', amount: 30 },
    ])
    expect(g.map(x => [x.month, x.items.length, x.total])).toEqual([[0, 2, 100], [1, 1, 30]])
  })
})

describe('usesRecurring', () => {
  it('detecta masters, hijos y parcialidades', () => {
    expect(usesRecurring([{ ...base }])).toBe(false)
    expect(usesRecurring([{ ...base, is_master: true }])).toBe(true)
    expect(usesRecurring([{ ...base, parent_id: 'm' }])).toBe(true)
  })
})

import { totalsByCategory } from '../src/lib/categoryHistory'
describe('totalsByCategory', () => {
  it('suma por categoría (en espacios compartidos ya viene solo la parte propia)', () => {
    expect(totalsByCategory([
      { category: 'Servicios', amount: 100 },
      { category: 'Servicios', amount: 500 },
      { category: 'Otros', amount: 20 },
    ])).toEqual({ Servicios: 600, Otros: 20 })
  })
})
