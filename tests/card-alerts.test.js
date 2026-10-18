import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { BANKS } from '../src/lib/cardCatalog'

const require = createRequire(import.meta.url)
const { cardAlerts, cardName, addDays, BANK_NAMES } = require('../api/_cardAlerts')
const { cardCutText, cardReminderText, cardDueText, cardDateLabel } = require('../api/_notifyText')

const card = (over = {}) => ({ id: 'c1', kind: 'credit', cut_day: 18, due_day: 7, bank: 'bbva', ...over })
const types = (cards, today, days = 3) => cardAlerts(cards, today, days).map(a => a.type)

describe('avisos de tarjetas de crédito (cron)', () => {
  it('avisa el corte el mismo día, con su vencimiento en el mes siguiente', () => {
    const [a] = cardAlerts([card()], '2026-10-18', 3)
    expect(a).toMatchObject({ type: 'card_cut', cutDate: '2026-10-18', dueDate: '2026-11-07' })
  })
  it('recordatorio N días antes del vencimiento y aviso el mismo día', () => {
    expect(types([card()], '2026-11-04', 3)).toEqual(['card_reminder'])
    expect(types([card()], '2026-11-07', 3)).toEqual(['card_due'])
    expect(types([card()], '2026-11-05', 3)).toEqual([])
  })
  it('sin recordatorio si los días antes son 0', () => {
    expect(types([card()], '2026-11-07', 0)).toEqual(['card_due'])
    expect(types([card()], '2026-11-07', 0)).not.toContain('card_reminder')
  })
  it('el día de corte inexistente cae en el último día del mes', () => {
    expect(types([card({ cut_day: 31, due_day: 20 })], '2026-11-30', 3)).toEqual(['card_cut'])
    expect(types([card({ cut_day: 31, due_day: 20 })], '2026-02-28', 3)).toEqual(['card_cut'])
  })
  it('ignora débito, sin corte y sin día límite (solo corte)', () => {
    expect(types([card({ kind: 'debit' })], '2026-10-18')).toEqual([])
    expect(types([card({ cut_day: null })], '2026-10-18')).toEqual([])
    expect(types([card({ due_day: null })], '2026-10-18')).toEqual(['card_cut'])
  })
  it('addDays cruza mes y año', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
  })
  it('nombre: alias, luego banco, luego genérico', () => {
    expect(cardName(card({ alias: 'Oro' }), 'es')).toBe('Oro')
    expect(cardName(card(), 'es')).toBe('BBVA')
    expect(cardName(card({ bank: 'otro' }), 'en')).toBe('Credit card')
  })
  it('el catálogo del servidor cubre todos los bancos del cliente', () => {
    for (const b of BANKS.filter(b => b.id !== 'otro')) expect(BANK_NAMES[b.id], b.id).toBe(b.name)
  })
  it('textos en ambos idiomas, individual y agrupado', () => {
    const due = cardDateLabel('es', '2026-11-07')
    expect(due).toBe('7 de noviembre')
    expect(cardCutText('es', ['BBVA'], due).title).toBe('BBVA hace corte hoy')
    expect(cardCutText('es', ['BBVA', 'Nu'], null).title).toBe('2 tarjetas hacen corte hoy')
    expect(cardReminderText('en', ['Nu'], 1, 'November 7').title).toBe('Nu payment in 1 day')
    expect(cardDueText('es', ['Nu', 'BBVA']).title).toBe('Hoy vencen 2 pagos de tarjeta')
  })
})
