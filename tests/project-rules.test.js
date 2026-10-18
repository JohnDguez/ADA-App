import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(import.meta.dirname, '..')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

function flatKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? flatKeys(v, prefix + k + '.') : [prefix + k])
}

describe('reglas del proyecto', () => {
  it('es.json y en.json tienen exactamente las mismas claves', () => {
    const es = flatKeys(JSON.parse(readFileSync(join(root, 'src/i18n/es.json'), 'utf8')))
    const en = flatKeys(JSON.parse(readFileSync(join(root, 'src/i18n/en.json'), 'utf8')))
    const onlyEs = es.filter(k => !en.includes(k))
    const onlyEn = en.filter(k => !es.includes(k))
    expect({ onlyEs, onlyEn }).toEqual({ onlyEs: [], onlyEn: [] })
  })

  it('los textos de la interfaz en español no usan lenguaje informal ni mexicanismos (Regla 51)', () => {
    const es = JSON.parse(readFileSync(join(root, 'src/i18n/es.json'), 'utf8'))
    const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) =>
      v && typeof v === 'object' ? flat(v, p + k + '.') : [[p + k, String(v)]])
    const banned = /\b(roomies?|depa|chiquit[oa]s?|nomás|ahorita|chamba|lana|plata|corta el|cortan el)\b/i
    const bad = flat(es).filter(([, v]) => banned.test(v)).map(([k]) => k)
    expect(bad).toEqual([])
  })

  it('ningún .module.css lleva colores fijos (hex/rgb/rgba); se usan variables de index.css', () => {
    const files = walk(join(root, 'src')).filter(f => f.endsWith('.module.css'))
    const bad = []
    for (const f of files) {
      const css = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
      css.split('\n').forEach((line, i) => {
        if (/#[0-9a-fA-F]{3,8}\b/.test(line) || /\brgba?\(/.test(line)) bad.push(`${relative(root, f)}:${i + 1}`)
      })
    }
    expect(bad).toEqual([])
  })

  it('api/ mantiene como máximo 12 funciones (límite del plan Hobby de Vercel)', () => {
    const fns = readdirSync(join(root, 'api')).filter(f => f.endsWith('.js') && !f.startsWith('_'))
    expect(fns.length).toBeLessThanOrEqual(12)
  })
})
