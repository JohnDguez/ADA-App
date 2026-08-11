import { useState, useEffect } from 'react'

const STORAGE_KEY = 'lunapay-rail-expanded'

/**
 * Estado colapsado/expandido de NavRail.jsx, persistido en localStorage —
 * NUNCA Supabase (Regla 49): es preferencia de UI ligada al dispositivo,
 * no dato de negocio, mismo criterio que useTheme.js con el tema
 * claro/oscuro. Lectura SÍNCRONA antes del primer render (default false,
 * colapsado) para no parpadear al estado por defecto.
 *
 * v0.9.365 le había agregado sincronizar una variable CSS `--rail-width`
 * para que #root reservara más espacio al expandir — v0.9.366 lo revirtió
 * por completo: el riel expandido ahora se SOBREPONE al contenido en vez
 * de empujarlo (index.css, #root usa margin-left fijo a 72px siempre), así
 * que este hook vuelve a ser solo persistencia, sin efectos sobre CSS.
 */
export function useRailExpanded() {
  const [expanded, setExpanded] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(expanded))
  }, [expanded])

  return [expanded, setExpanded]
}
