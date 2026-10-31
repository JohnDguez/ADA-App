import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRequire } from 'node:module'
import { dateToStr, cobroPeriod, nextCobroPeriod, shiftPayday, periodSalary } from '../src/lib/utils'

// api/ es CommonJS (su propio package.json); se carga con require.
const require = createRequire(import.meta.url)
const server = require('../api/_cobroPeriod.js')

// "Hoy" fijo: viernes 16 de octubre de 2026, 10:00 hora local.
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 16, 10)) })
afterEach(() => { vi.useRealTimers() })

const span = p => [dateToStr(p.start), dateToStr(p.end), dateToStr(p.nextCobro)]
const q = shift => ({ cobro_freq: 'biweekly', cobro_day1: 15, cobro_day2: 30, cobro_weekend_shift: shift })

describe('recorrer el día de cobro en fin de semana (v0.9.966)', () => {
  it('shiftPayday mueve solo sábados y domingos, según el modo', () => {
    const sat = new Date(2027, 0, 30), sun = new Date(2026, 10, 15), mon = new Date(2026, 10, 30)
    expect(dateToStr(shiftPayday(sat, 'near'))).toBe('2027-01-29')
    expect(dateToStr(shiftPayday(sun, 'near'))).toBe('2026-11-16')
    expect(dateToStr(shiftPayday(sun, 'prev'))).toBe('2026-11-13')
    expect(dateToStr(shiftPayday(sat, 'next'))).toBe('2027-02-01')
    expect(dateToStr(shiftPayday(mon, 'near'))).toBe('2026-11-30')
    expect(dateToStr(shiftPayday(sun, null))).toBe('2026-11-15')
  })
  it('apagado: igual que antes (15 nov domingo sigue siendo el 15)', () => {
    expect(span(cobroPeriod(q(null), new Date(2026, 10, 10)))).toEqual(['2026-10-30', '2026-11-14', '2026-11-15'])
  })
  it('día hábil más cercano: el periodo se alarga hasta el lunes 16', () => {
    expect(span(cobroPeriod(q('near'), new Date(2026, 10, 10)))).toEqual(['2026-10-30', '2026-11-15', '2026-11-16'])
    // El domingo 15 todavía pertenece al periodo anterior.
    expect(span(cobroPeriod(q('near'), new Date(2026, 10, 15)))).toEqual(['2026-10-30', '2026-11-15', '2026-11-16'])
  })
  it('viernes anterior: el cobro del domingo 15 llega el viernes 13', () => {
    expect(span(cobroPeriod(q('prev'), new Date(2026, 10, 14)))).toEqual(['2026-11-13', '2026-11-29', '2026-11-30'])
  })
  it('sábado 30 de enero se cobra el viernes 29', () => {
    expect(span(cobroPeriod(q('near'), new Date(2027, 0, 29)))).toEqual(['2027-01-29', '2027-02-14', '2027-02-15'])
  })
  it('mensual día 31: sábado 31 oct se recorre al viernes 30', () => {
    const cfg = { cobro_freq: 'monthly', cobro_day1: 31, cobro_weekend_shift: 'near' }
    expect(span(cobroPeriod(cfg))).toEqual(['2026-09-30', '2026-10-29', '2026-10-30'])
  })
  it('semanal ignora la opción', () => {
    const cfg = { cobro_freq: 'weekly', cobro_weekday: 5, cobro_weekend_shift: 'near' }
    expect(span(cobroPeriod(cfg))).toEqual(['2026-10-16', '2026-10-22', '2026-10-23'])
  })
  it('el siguiente periodo también respeta el recorrido', () => {
    const nx = nextCobroPeriod(q('near'))
    expect([dateToStr(nx.start), dateToStr(nx.end)]).toEqual(['2026-10-30', '2026-11-15'])
  })
  it('el servidor calcula lo mismo que el cliente', () => {
    for (const [cfg, ref] of [[q('near'), new Date(2026, 10, 15)], [q('prev'), new Date(2026, 10, 14)], [q(null), new Date(2027, 0, 30)], [{ cobro_freq: 'monthly', cobro_day1: 31, cobro_weekend_shift: 'next' }, new Date(2026, 9, 20)]]) {
      expect(span(server.cobroPeriod(cfg, ref))).toEqual(span(cobroPeriod(cfg, ref)))
    }
  })
})

describe('ingreso que cambia desde el próximo periodo (v0.9.968)', () => {
  const p = { salary_enabled: true, salary_amount: 6000, salary_prev_amount: 1500, salary_change_from: '2026-11-16' }
  it('los periodos que empiezan antes de la fecha usan el monto anterior', () => {
    expect(periodSalary(p, new Date(2026, 9, 30))).toBe(1500)
    expect(periodSalary(p, '2026-11-15')).toBe(1500)
  })
  it('desde la fecha usa el monto nuevo', () => {
    expect(periodSalary(p, new Date(2026, 10, 16))).toBe(6000)
    expect(periodSalary(p, '2026-12-01')).toBe(6000)
  })
  it('sin cambio pendiente o sin ingreso activado', () => {
    expect(periodSalary({ salary_enabled: true, salary_amount: 6000 }, '2026-10-30')).toBe(6000)
    expect(periodSalary({ ...p, salary_enabled: false }, '2026-10-30')).toBe(0)
  })
  it('el servidor calcula lo mismo', () => {
    for (const d of ['2026-10-30', '2026-11-16']) expect(server.periodSalary(p, d)).toBe(periodSalary(p, d))
  })
})
