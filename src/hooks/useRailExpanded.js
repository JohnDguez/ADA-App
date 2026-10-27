import { useState, useEffect } from 'react'

const STORAGE_KEY = 'lunapay-rail-expanded'
// v0.9.814 — en escritorio (≥1100px) el riel arranca ABIERTO y fijo (empuja
// el contenido); el usuario puede cerrarlo y esa decisión se recuerda aparte
// de la de tablet (que sigue siendo colapsado por defecto y sobrepuesto).
const STORAGE_KEY_DESKTOP = 'lunapay-rail-expanded-desktop'

/**
 * Estado colapsado/expandido de NavRail.jsx, persistido en localStorage —
 * NUNCA Supabase (Regla 49): es preferencia de UI ligada al dispositivo,
 * no dato de negocio, mismo criterio que useTheme.js con el tema
 * claro/oscuro. Lectura SÍNCRONA antes del primer render para no
 * parpadear al estado por defecto.
 *
 * `desktop` elige cuál de los dos estados se usa/devuelve: tablet
 * (default colapsado) o escritorio (default expandido).
 */
export function useRailExpanded(desktop = false) {
  const [tablet, setTablet] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')
  const [wide, setWide] = useState(() => localStorage.getItem(STORAGE_KEY_DESKTOP) !== 'false')

  useEffect(() => { localStorage.setItem(STORAGE_KEY, String(tablet)) }, [tablet])
  useEffect(() => { localStorage.setItem(STORAGE_KEY_DESKTOP, String(wide)) }, [wide])

  return desktop ? [wide, setWide] : [tablet, setTablet]
}
