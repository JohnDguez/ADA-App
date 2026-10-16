import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

// api/ es CommonJS (su propio package.json); se carga con require.
const require = createRequire(import.meta.url)
const { dateStrInTz, DEFAULT_TZ } = require('../api/_tz.js')

describe('api/_tz.js', () => {
  it('después de las 5 pm en Mazatlán el servidor (UTC) ya está en "mañana", pero el usuario no', () => {
    const instant = new Date('2026-10-17T02:30:00Z') // 19:30 del 16 en Mazatlán (UTC-7)
    expect(dateStrInTz(instant, 'America/Mazatlan')).toBe('2026-10-16')
    expect(dateStrInTz(instant, 'UTC')).toBe('2026-10-17')
  })
  it('zona vacía o inválida cae al default', () => {
    const instant = new Date('2026-10-17T02:30:00Z')
    expect(DEFAULT_TZ).toBe('America/Mazatlan')
    expect(dateStrInTz(instant, null)).toBe('2026-10-16')
    expect(dateStrInTz(instant, 'No/Existe')).toBe('2026-10-16')
  })
})
