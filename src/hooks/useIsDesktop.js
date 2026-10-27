import { useState, useEffect } from 'react'

/**
 * true cuando el ancho es ≥1100px (escritorio, v0.9.814). Un solo lugar
 * para el breakpoint que comparten HomePage.jsx y NavRail.jsx (riel fijo
 * abierto en escritorio, layout propio de Inicio).
 */
export function useIsDesktop() {
  const query = '(min-width: 1100px)'
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = e => setIsDesktop(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isDesktop
}
