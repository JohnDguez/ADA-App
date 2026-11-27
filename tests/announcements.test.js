import { describe, it, expect } from 'vitest'
import {
  ANNOUNCEMENTS, GAP_DAYS, QUIET_HOURS, emptyState, normalizeState, armedAt, pickNext, bannerItem, historyList, notificationItem,
} from '../src/lib/announcements'
import es from '../src/i18n/es.json'
import en from '../src/i18n/en.json'

const cat = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
const T0 = new Date('2026-11-20T10:00:00Z')
const plus = (d, h) => new Date(d.getTime() + h * 3600000)
const armed = (d = T0) => ({ ...emptyState(), armed: d.toISOString() })

describe('cola de novedades', () => {
  it('espera el margen de 3 h tras onboarding y tutorial', () => {
    expect(pickNext(armed(), plus(T0, 2), cat)).toBeNull()
    expect(pickNext(armed(), plus(T0, QUIET_HOURS), cat).id).toBe('a')
  })
  it('no muestra nada si el onboarding o el tutorial no están listos', () => {
    expect(pickNext(armed(), plus(T0, 10), cat, false)).toBeNull()
    expect(pickNext(emptyState(), plus(T0, 10), cat, true)).toBeNull()
  })
  it('una por vez, cada 2 días desde la última mostrada', () => {
    const st = { ...armed(), last: plus(T0, 3).toISOString(), shown: { a: plus(T0, 3).toISOString() } }
    expect(pickNext(st, plus(T0, 3 + 24), cat)).toBeNull()
    expect(pickNext(st, plus(T0, 3 + GAP_DAYS * 24), cat).id).toBe('b')
  })
  it('quien tarda días en abrir la app recibe solo una', () => {
    const st = { ...armed(), last: T0.toISOString(), shown: { a: T0.toISOString() } }
    const later = plus(T0, 24 * 10)
    expect(pickNext(st, later, cat).id).toBe('b')
  })
  it('sin pendientes devuelve null', () => {
    const shown = { a: '2026-11-01T00:00:00Z', b: '2026-11-03T00:00:00Z', c: '2026-11-05T00:00:00Z' }
    expect(pickNext({ ...armed(), last: shown.c, shown }, plus(T0, 24 * 30), cat)).toBeNull()
  })
  it('un aviso urgente se salta la cola, el margen y el intervalo', () => {
    const c = [{ id: 'u', urgent: true }, ...cat]
    expect(pickNext(emptyState(), T0, c, false).id).toBe('u')
    expect(pickNext({ ...armed(), last: T0.toISOString(), shown: { u: 'x' } }, plus(T0, 1), c)).toBeNull()
  })
  it('cuentas con más de un día no esperan el margen', () => {
    const now = new Date('2026-11-20T10:00:00Z')
    expect(new Date(armedAt('2026-01-01T00:00:00Z', now)).getTime()).toBe(now.getTime() - QUIET_HOURS * 3600000)
    expect(armedAt(now.toISOString(), now)).toBe(now.toISOString())
  })
})

describe('estado, tarjeta e historial', () => {
  it('migra el formato anterior de localStorage', () => {
    const st = normalizeState(null, { seen: ['a'], dismissed: ['a'] }, T0)
    expect(st.shown.a).toBe(T0.toISOString())
    expect(st.last).toBe(T0.toISOString())
    expect(st.dismissed).toEqual(['a'])
    expect(pickNext(st, plus(T0, 24), cat)).toBeNull()
    expect(pickNext(st, plus(T0, 48), cat).id).toBe('b')
  })
  it('respeta el estado guardado y rellena lo que falte', () => {
    expect(normalizeState({ shown: { a: 'x' } }, null).dismissed).toEqual([])
    expect(normalizeState(null, null)).toEqual(emptyState())
  })
  it('la tarjeta de Inicio es la última mostrada sin descartar', () => {
    const st = { ...emptyState(), shown: { a: '2026-11-01T00:00:00Z', b: '2026-11-03T00:00:00Z' } }
    expect(bannerItem(st, cat).id).toBe('b')
    expect(bannerItem({ ...st, dismissed: ['b'] }, cat).id).toBe('a')
    expect(bannerItem(emptyState(), cat)).toBeNull()
  })
  it('la notificación de escritorio sigue aunque se descarte la tarjeta y se quita aparte', () => {
    const st = { ...emptyState(), dismissed: ['b'], shown: { a: '2026-11-01T00:00:00Z', b: '2026-11-03T00:00:00Z' } }
    const ns = { read: [], removed: [] }
    expect(notificationItem(st, ns, cat).a.id).toBe('b')
    expect(notificationItem(st, { read: ['b'], removed: [] }, cat).read).toBe(true)
    expect(notificationItem(st, { read: [], removed: ['b'] }, cat).a.id).toBe('a')
    expect(notificationItem(emptyState(), ns, cat)).toBeNull()
  })
  it('el historial muestra todo: lo mostrado (reciente arriba) y luego lo pendiente', () => {
    const st = { ...emptyState(), shown: { b: '2026-11-03T00:00:00Z' } }
    const h = historyList(st, cat)
    expect(h.map(x => x.a.id)).toEqual(['b', 'a', 'c'])
    expect(h[0].shownAt).toBeTruthy(); expect(h[1].shownAt).toBeNull()
  })
})

describe('catálogo', () => {
  it('cada anuncio tiene textos en es y en, con sus filas', () => {
    for (const a of ANNOUNCEMENTS) {
      for (const d of [es, en]) {
        const it = d.announcements.items[a.id]
        expect(it?.title).toBeTruthy(); expect(it?.text).toBeTruthy()
        expect(it.rows.length).toBe(a.rows.length)
        expect(d.announcements.kind[a.kind]).toBeTruthy()
      }
    }
  })
  it('los ids no se repiten', () => {
    expect(new Set(ANNOUNCEMENTS.map(a => a.id)).size).toBe(ANNOUNCEMENTS.length)
  })
})
