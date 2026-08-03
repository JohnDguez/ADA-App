import i18n from '../i18n'
import { getMonths } from './utils'

// Fuente única de verdad para la versión visible al usuario (footer de SettingsPage,
// modal de Novedades). No confundir con el historial técnico completo en CONTEXT.md:
// aquí solo van cambios que le sirven o interesan al usuario final.
export const APP_VERSION = '0.9.183'

// getPatchNotes() en vez de un arreglo exportado directo — mismo motivo que
// getCoachmarkSteps()/getMonths(): un arreglo a nivel de módulo se evalúa
// UNA sola vez al importar, capturando el idioma activo en ese momento y
// sin enterarse nunca de un cambio posterior. Como función, se recalcula
// fresca cada vez que App.jsx la usa (dentro del useEffect que arma
// patchNotesToShow). El texto real de cada nota vive en
// src/i18n/es.json|en.json → patchNotes.v{versión}.item{N} — este archivo
// solo arma la estructura y el orden.
//
// `date` se genera con getMonths() (el mismo helper localizado vía Intl que
// ya usa el resto de la app) en vez de un string "Julio 2026" fijo — el mes
// se guarda como índice (0=enero) junto al año, y se arma la etiqueta aquí.
//
// Orden: más reciente primero. Solo agregar entradas con contenido útil
// para el usuario.
export function getPatchNotes() {
  const t = i18n.t.bind(i18n)
  const months = getMonths()
  const dateOf = (monthIndex, year) => `${months[monthIndex]} ${year}`

  return [
    {
      version: '0.9.183',
      date: dateOf(6, 2026), // Julio
      items: [
        t('patchNotes.v0_9_183.item0'),
      ],
    },
    {
      version: '0.9.135',
      date: dateOf(6, 2026),
      items: [
        t('patchNotes.v0_9_135.item0'),
        t('patchNotes.v0_9_135.item1'),
        t('patchNotes.v0_9_135.item2'),
        t('patchNotes.v0_9_135.item3'),
        t('patchNotes.v0_9_135.item4'),
        t('patchNotes.v0_9_135.item5'),
      ],
    },
    {
      version: '0.9.88',
      date: dateOf(6, 2026),
      items: [
        t('patchNotes.v0_9_88.item0'),
      ],
    },
    {
      version: '0.9.71',
      date: dateOf(6, 2026),
      items: [
        t('patchNotes.v0_9_71.item0'),
        t('patchNotes.v0_9_71.item1'),
      ],
    },
    {
      version: '0.9.51',
      date: dateOf(6, 2026),
      items: [
        t('patchNotes.v0_9_51.item0'),
      ],
    },
    {
      version: '0.9.48',
      date: dateOf(6, 2026),
      items: [
        t('patchNotes.v0_9_48.item0'),
      ],
    },
    {
      version: '0.9.37',
      date: dateOf(6, 2026),
      items: [
        t('patchNotes.v0_9_37.item0'),
      ],
    },
    {
      version: '0.9.36',
      date: dateOf(6, 2026),
      items: [
        t('patchNotes.v0_9_36.item0'),
      ],
    },
    {
      version: '0.9.34',
      date: dateOf(6, 2026),
      items: [
        t('patchNotes.v0_9_34.item0'),
      ],
    },
    {
      version: '0.9.33',
      date: dateOf(6, 2026),
      items: [
        t('patchNotes.v0_9_33.item0'),
      ],
    },
    {
      version: '0.9.32',
      date: dateOf(6, 2026),
      items: [
        t('patchNotes.v0_9_32.item0'),
      ],
    },
    {
      version: '0.9.31',
      date: dateOf(6, 2026),
      items: [
        t('patchNotes.v0_9_31.item0'),
      ],
    },
    {
      version: '0.9.30',
      date: dateOf(6, 2026),
      items: [
        t('patchNotes.v0_9_30.item0'),
      ],
    },
  ]
}

// Compara versiones tipo "0.9.34" numéricamente (no alfabéticamente, ya que
// "0.9.9" > "0.9.34" como texto pero no como versión real)
export function isNewerVersion(version, baseline) {
  if (!baseline) return true
  const a = version.split('.').map(Number)
  const b = baseline.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0
    if (x !== y) return x > y
  }
  return false
}
