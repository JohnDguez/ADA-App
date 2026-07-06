// Fuente única de verdad para la versión visible al usuario (footer de SettingsPage,
// modal de Novedades). No confundir con el historial técnico completo en CONTEXT.md:
// aquí solo van cambios que le sirven o interesan al usuario final.
export const APP_VERSION = '0.9.40'

// Cada entrada: { version, date, items: [string] }
// Orden: más reciente primero. Solo agregar entradas con contenido útil para el usuario.
export const PATCH_NOTES = [
  {
    version: '0.9.37',
    date: 'Julio 2026',
    items: [
      'Corregido: el aviso de novedades ya no vuelve a aparecer cada vez que abres la app.',
    ],
  },
  {
    version: '0.9.36',
    date: 'Julio 2026',
    items: [
      'Los menús y ventanas emergentes ahora entran con una animación suave desde abajo.',
    ],
  },
  {
    version: '0.9.34',
    date: 'Julio 2026',
    items: [
      'Ahora puedes editar o eliminar un ingreso extra ya registrado, desde el botón "Editar" junto a "Ingresos Extras Este Periodo".',
    ],
  },
  {
    version: '0.9.33',
    date: 'Julio 2026',
    items: [
      'Corregido: la tarjeta de inicio ya reconoce correctamente los pagos variables pendientes en vez de marcarlos como "sin pendientes".',
    ],
  },
  {
    version: '0.9.32',
    date: 'Julio 2026',
    items: [
      'Corregido: las notificaciones ya no llegan repetidas cada hora — vuelven a respetar la hora que configuraste.',
    ],
  },
  {
    version: '0.9.31',
    date: 'Julio 2026',
    items: [
      'Ahora puedes editar la fecha en que pagaste un pago único, desde la pantalla de edición.',
    ],
  },
  {
    version: '0.9.30',
    date: 'Julio 2026',
    items: [
      'Nuevo fondo animado en la pantalla de inicio, que cambia según la hora del día.',
    ],
  },
]

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
