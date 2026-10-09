import { useState, useEffect } from 'react'
import styles from './Collapse.module.css'

// Despliegue suave (alto + opacidad) para secciones que aparecen/desaparecen.
// Monta los hijos al abrir, anima 0→alto natural (grid 0fr→1fr) y los
// desmonta al terminar de cerrar. Respeta prefers-reduced-motion (CSS).
const EXIT_MS = 240

export function Collapse({ open, children }) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(open)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(id)
    }
    setShown(false)
    const tm = setTimeout(() => setMounted(false), EXIT_MS)
    return () => clearTimeout(tm)
  }, [open])

  if (!mounted) return null
  return (
    <div className={`${styles.wrap} ${shown ? styles.open : ''}`}>
      <div className={styles.inner}>{children}</div>
    </div>
  )
}
