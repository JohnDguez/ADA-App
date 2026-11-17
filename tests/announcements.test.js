import { describe, it, expect } from 'vitest'
import { ANNOUNCEMENTS, computeState, visibleAnnouncements, freshAnnouncements, FIRST_RUN_DAYS } from '../src/lib/announcements'
import es from '../src/i18n/es.json'
import en from '../src/i18n/en.json'

const cat = [
  { id: 'a', date: '2026-11-16' }, { id: 'b', date: '2026-10-01' }, { id: 'c', date: '2026-06-01' },
]

describe('novedades', () => {
  it('el historial ordena de la más nueva a la más vieja', () => {
    expect(visibleAnnouncements(cat, new Date('2026-11-17T12:00:00')).map(a => a.id)).toEqual(['a', 'b', 'c'])
  })
  it('modal y tarjeta de Inicio omiten lo anterior a la cuenta; el historial no', () => {
    const list = visibleAnnouncements(cat, new Date('2026-11-17T12:00:00'))
    expect(freshAnnouncements(list, '2026-10-15T10:00:00').map(a => a.id)).toEqual(['a'])
    expect(freshAnnouncements(list, null).length).toBe(3)
    expect(list.length).toBe(3)
  })
  it('una fecha futura queda programada y no se muestra todavía', () => {
    const now = new Date('2026-11-17T12:00:00')
    expect(visibleAnnouncements([{ id: 'f', date: '2026-11-18' }, ...cat], now).map(a => a.id)).toEqual(['a', 'b', 'c'])
    expect(visibleAnnouncements([{ id: 'f', date: '2026-11-18' }, ...cat], new Date('2026-11-18T08:00:00')).map(a => a.id)[0]).toBe('f')
  })
  it('en un dispositivo nuevo solo quedan sin ver las recientes', () => {
    const st = computeState(null, [], new Date('2026-11-17T12:00:00'), cat)
    expect(st.seen).toEqual(['b', 'c'])
    expect(st.seen).not.toContain('a')
    expect(FIRST_RUN_DAYS).toBe(14)
  })
  it('respeta el estado guardado', () => {
    const stored = { seen: ['a'], dismissed: [] }
    expect(computeState(stored, [], new Date(), cat)).toBe(stored)
  })
  it('cada anuncio del catálogo tiene textos en es y en', () => {
    for (const a of ANNOUNCEMENTS) {
      for (const d of [es, en]) {
        const it = d.announcements.items[a.id]
        expect(it?.title).toBeTruthy(); expect(it?.text).toBeTruthy()
        expect(it.rows.length).toBe(a.rows.length)
        expect(d.announcements.kind[a.kind]).toBeTruthy()
      }
    }
  })
})
