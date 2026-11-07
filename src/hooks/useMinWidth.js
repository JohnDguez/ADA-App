import { useState, useEffect } from 'react'

/**
 * true cuando el ancho de la ventana es ≥ `px`. Para separar tablet vertical
 * (768–959) de tablet horizontal (≥960) en el onboarding, sin duplicar el
 * patrón de useIsDesktop/useIsMobile.
 */
export function useMinWidth(px) {
  const query = `(min-width: ${px}px)`
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = e => setMatches(e.matches)
    setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}
