import { useState, useEffect } from 'react'

/**
 * true cuando el ancho es <768px (móvil). Tablet (768–1099px) y escritorio
 * (≥1100px) conservan sus propios layouts. Lo usa el Inicio móvil nuevo
 * (v0.9.885) para decidir qué se renderiza, no solo el CSS.
 */
export function useIsMobile() {
  const query = '(max-width: 767px)'
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = e => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isMobile
}
