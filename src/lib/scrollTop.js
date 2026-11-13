import { useLayoutEffect } from 'react'

// Regla 77: al entrar a un detalle o subpantalla que reemplaza a la lista en la
// MISMA página (el cambio es de estado, no una navegación de verdad), el
// navegador conserva el scroll de la lista y el detalle aparecía ya desplazado.
// Todo panel de detalle de pantalla completa llama a este hook al montarse para
// empezar desde arriba. `enabled` = solo cuando el panel ocupa la página (no en
// el modo flotante/lateral de tablet y escritorio, que tiene su propio scroll).
export function useScrollTopOnOpen(enabled = true) {
  useLayoutEffect(() => {
    if (enabled) window.scrollTo(0, 0)
  }, [enabled])
}
