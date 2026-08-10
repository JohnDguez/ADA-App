import { useState, useEffect } from 'react'

const STORAGE_KEY = 'lunapay-rail-expanded'

/**
 * Estado colapsado/expandido de NavRail.jsx, persistido en localStorage —
 * NUNCA Supabase (Regla 49): es preferencia de UI ligada al dispositivo,
 * no dato de negocio, mismo criterio que useTheme.js con el tema
 * claro/oscuro. Lectura SÍNCRONA antes del primer render (default false,
 * colapsado) para no parpadear al estado por defecto.
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
