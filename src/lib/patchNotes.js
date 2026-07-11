// Fuente única de verdad para la versión visible al usuario (footer de SettingsPage,
// modal de Novedades). No confundir con el historial técnico completo en CONTEXT.md:
// aquí solo van cambios que le sirven o interesan al usuario final.
export const APP_VERSION = '0.9.135'

// Cada entrada: { version, date, items: [string] }
// Orden: más reciente primero. Solo agregar entradas con contenido útil para el usuario.
export const PATCH_NOTES = [
  {
    version: '0.9.135',
    date: 'Julio 2026',
    items: [
      'Nuevo: Espacio Compartido — lleva las cuentas de la casa, la renta o el súper junto con tu pareja o roomie, en un espacio aparte de tu cuenta Personal.',
      'Si eres Premium, puedes crear tu propio Espacio Compartido (con su propio periodo de cobro) e invitar a alguien con un código de 6 dígitos.',
      'Sin necesidad de Premium, puedes unirte hasta a 3 Espacios Compartidos con el código que te compartan.',
      'El dueño decide qué puede hacer cada invitado dentro del espacio: agregar pagos, editarlos, marcarlos como pagados, eliminarlos, o agregar ingresos extra — cada permiso se activa por separado.',
      'Todo se sincroniza al instante entre quienes comparten el espacio, sin necesidad de recargar la app.',
      'Cambia entre tu cuenta Personal y tus Espacios Compartidos desde el nuevo selector apilado, arriba de Inicio, Gastos y Recurrentes.',
    ],
  },
  {
    version: '0.9.88',
    date: 'Julio 2026',
    items: [
      'Nuevo: en un pago variable pendiente (como luz o agua) ahora puedes anotar el monto en cuanto lo sepas — desde el menú de opciones, "Agregar monto". Se guarda listo para cuando confirmes el pago, sin afectar pagos pasados ni futuros de esa misma serie.',
    ],
  },
  {
    version: '0.9.71',
    date: 'Julio 2026',
    items: [
      'Ajustes ahora está organizado en un menú — Cuenta, Categorías, Periodo de cobro e ingresos, Notificaciones y Apariencia, cada uno en su propia pantalla.',
      'Nuevo: personaliza tus categorías con íconos y colores propios, y crea las tuyas desde Ajustes → Categorías.',
    ],
  },
  {
    version: '0.9.51',
    date: 'Julio 2026',
    items: [
      '¡Evolucionamos! Ahora somos LunaPay — mismo control de tu quincena, nuevo nombre y logo.',
    ],
  },
  {
    version: '0.9.48',
    date: 'Julio 2026',
    items: [
      'Los montos ahora muestran siempre 2 decimales, útil para pagos con tarjeta u otros montos exactos.',
    ],
  },
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
