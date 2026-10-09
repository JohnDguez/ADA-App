import { useState, useEffect } from 'react'

// Mantiene montada una superposición durante su animación de salida.
// `render` = dibujarla; `closing` = está saliendo (poner data-closing).
// `ms` debe coincidir con la duración de salida en index.css ([data-presence]).
export const EXIT_MS = 220

export function usePresence(open, ms = EXIT_MS) {
  const [render, setRender] = useState(open)
  useEffect(() => {
    if (open) { setRender(true); return undefined }
    const id = setTimeout(() => setRender(false), ms)
    return () => clearTimeout(id)
  }, [open, ms])
  return { render: open || render, closing: !open && render }
}
