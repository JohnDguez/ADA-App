import { useState, useEffect } from 'react'

const STORAGE_KEY = 'lunapay-rail-expanded'

// Mismos valores que NavRail.module.css (.rail / .rail[data-expanded="true"])
// — si esos cambian, actualizar aquí también (Regla 30, JS/CSS timing sync,
// aplica igual a valores de layout compartidos entre JS y CSS).
const RAIL_WIDTH_COLLAPSED = '72px'
const RAIL_WIDTH_EXPANDED  = '240px'

/**
 * Estado colapsado/expandido de NavRail.jsx, persistido en localStorage —
 * NUNCA Supabase (Regla 49): es preferencia de UI ligada al dispositivo,
 * no dato de negocio, mismo criterio que useTheme.js con el tema
 * claro/oscuro. Lectura SÍNCRONA antes del primer render (default false,
 * colapsado) para no parpadear al estado por defecto.
 *
 * v0.9.365 (adaptación tablet/desktop, Home) — además de persistir el
 * estado, mantiene la variable CSS `--rail-width` en `:root` sincronizada
 * con él: `#root` (index.css, @media 768px) la usa para reservar el
 * espacio del riel y que el contenido de cada página no quede tapado por
 * él. Se fija de forma síncrona en el mismo lazy initializer (antes del
 * primer render) para que, si el usuario ya tenía el riel expandido, el
 * contenido arranque con el margen correcto desde el primer pintado —
 * sin esto, arrancaría siempre en 72px y saltaría a 240px un instante
 * después.
 */
export function useRailExpanded() {
  const [expanded, setExpanded] = useState(() => {
    const initial = localStorage.getItem(STORAGE_KEY) === 'true'
    document.documentElement.style.setProperty('--rail-width', initial ? RAIL_WIDTH_EXPANDED : RAIL_WIDTH_COLLAPSED)
    return initial
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(expanded))
    document.documentElement.style.setProperty('--rail-width', expanded ? RAIL_WIDTH_EXPANDED : RAIL_WIDTH_COLLAPSED)
  }, [expanded])

  return [expanded, setExpanded]
}
