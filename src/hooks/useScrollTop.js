import { useEffect } from 'react'

// Lleva la página al inicio cada vez que cambia alguna de las dependencias
// (abrir un detalle, cambiar de sección dentro de una página, etc.). La app
// cambia de pantalla por estado de React, no por navegación real, así que
// el navegador no reinicia el scroll solo: sin esto, una pantalla nueva
// aparece ya desplazada con el scroll de la anterior.
export function useScrollTop(...deps) {
  useEffect(() => {
    window.scrollTo(0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
