import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRequire } from 'node:module'
import { queueHorizon, planQueue, planRecurrentCopies, queueCopyId } from '../src/lib/recurQueue'

// api/ es CommonJS (su propio package.json); se carga con require.
const require = createRequire(import.meta.url)
const server = require('../api/_recurQueue.js')

// "Hoy" fijo: sábado 31 de octubre de 2026, 10:00 hora local.
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 31, 10)) })
afterEach(() => { vi.useRealTimers() })

const quincena = { cobro_freq: 'biweekly', cobro_day1: 15, cobro_day2: 30, cobro_weekend_shift: 'near' }
const mensual  = { cobro_freq: 'monthly', cobro_day1: 1 }
const semanal  = { cobro_freq: 'weekly', cobro_weekday: 5 }
const today = new Date(2026, 9, 31)
const dates = plan => plan.map(p => p.due_date)
const copy = (due_date, extra = {}) => ({ due_date, is_paid: false, is_postponed: false, ...extra })

describe('cola de copias por horizonte (v0.9.972)', () => {
  it('horizonte = periodo actual + 2 siguientes', () => {
    // Quincena 15/30 con recorrido "near": 30 oct (vie) → 15 nov es domingo → lunes 16.
    expect(queueHorizon(quincena, today)).toEqual({ start: '2026-10-30', end: '2026-12-14' })
    expect(queueHorizon(mensual, today)).toEqual({ start: '2026-10-01', end: '2026-12-31' })
    expect(queueHorizon(semanal, today)).toEqual({ start: '2026-10-30', end: '2026-11-19' })
    expect(queueHorizon(null, today)).toBe(null)
  })

  it('el caso reportado: gasolina semanal con quincena llena los 3 periodos', () => {
    const hz = queueHorizon(quincena, today)
    // Hoy: sus 2 copias ya cayeron en la quincena actual.
    const copies = [copy('2026-11-02'), copy('2026-11-09')]
    const out = dates(planRecurrentCopies(copies, 'weekly', hz))
    expect(out).toEqual(['2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07', '2026-12-14'])
  })

  it('semanal con periodo mensual: unas 13 copias pendientes en total', () => {
    const hz = queueHorizon(mensual, today)
    const out = planQueue({ firstDate: '2026-10-05', pending: 0, freq: 'weekly', horizon: hz })
    expect(out.length).toBe(13)
    expect(out[out.length - 1].due_date <= hz.end).toBe(true)
  })

  it('pagos largos (anual) conservan el mínimo de 2 aunque salgan del horizonte', () => {
    const hz = queueHorizon(quincena, today)
    expect(dates(planQueue({ firstDate: '2027-03-01', pending: 0, freq: 'annual', horizon: hz }))).toEqual(['2027-03-01', '2028-03-01'])
  })

  it('sin configuración de cobro se comporta como antes: solo 2', () => {
    expect(planQueue({ firstDate: '2026-11-02', pending: 0, freq: 'weekly', horizon: null }).length).toBe(2)
  })

  it('si ya hay copias de más (periodo acortado), no crea nada', () => {
    const hz = queueHorizon(semanal, today)
    const six = ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07'].map(d => copy(d))
    expect(planRecurrentCopies(six, 'weekly', hz)).toEqual([])
  })

  it('no rellena semanas de periodos pasados (app sin abrir), salvo el mínimo', () => {
    const hz = queueHorizon(quincena, today)
    const stale = [copy('2026-08-03'), copy('2026-08-10')]
    const out = dates(planRecurrentCopies(stale, 'weekly', hz))
    expect(out[0] >= hz.start).toBe(true)
    expect(out[out.length - 1] <= hz.end).toBe(true)
  })

  it('pagadas y pospuestas no cuentan como pendientes', () => {
    const hz = queueHorizon(semanal, today)
    const copies = [copy('2026-11-06', { is_paid: true }), copy('2026-11-13', { is_postponed: true })]
    expect(dates(planRecurrentCopies(copies, 'weekly', hz))).toEqual(['2026-11-20', '2026-11-27'])
  })

  it('parcialidades: numeradas y nunca pasan del total', () => {
    const hz = queueHorizon(mensual, today)
    const out = planQueue({ lastDate: '2026-10-05', lastNum: 3, pending: 0, freq: 'weekly', horizon: hz, total: 6 })
    expect(out.map(p => p.current_installment)).toEqual([4, 5, 6])
  })

  it('cliente y servidor calculan exactamente lo mismo', () => {
    for (const cfg of [quincena, mensual, semanal, { ...quincena, cobro_weekend_shift: null }]) {
      expect(server.queueHorizon(cfg, today)).toEqual(queueHorizon(cfg, today))
      const hz = queueHorizon(cfg, today)
      for (const freq of ['weekly', 'biweekly', 'monthly', 'quarterly', 'annual']) {
        const args = { firstDate: '2026-10-09', pending: 0, freq, horizon: hz }
        expect(server.planQueue(args)).toEqual(planQueue(args))
        const inst = { lastDate: '2026-09-15', lastNum: 2, pending: 1, freq, horizon: hz, total: 9 }
        expect(server.planQueue(inst)).toEqual(planQueue(inst))
        const copies = [copy('2026-10-02', { is_paid: true }), copy('2026-10-16')]
        expect(server.planRecurrentCopies(copies, freq, hz)).toEqual(planRecurrentCopies(copies, freq, hz))
      }
    }
    expect(server.queueCopyId('abc', '2026-11-02')).toBe(queueCopyId('abc', '2026-11-02'))
  })

  it('id determinista con formato UUID, distinto por fecha', () => {
    const a = queueCopyId('m1', '2026-11-02'), b = queueCopyId('m1', '2026-11-09')
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(a).not.toBe(b)
    expect(queueCopyId('m1', '2026-11-02')).toBe(a)
  })
})
