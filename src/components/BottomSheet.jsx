import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBackClose } from '../lib/backNav'
import styles from './BottomSheet.module.css'
import { useScrollLock } from '../lib/scrollLock'
import { scrollSelectedIntoView } from '../lib/scrollSelected'

// Hoja inferior reutilizable para los selectores del formulario de pago
// (categoría, fecha, método). Mantiene el contenido montado el tiempo de la
// animación de salida (Regla 29). EXIT_MS debe coincidir con la duración de
// `.exiting` / `.panelExiting` en BottomSheet.module.css (Regla 30).
const EXIT_MS = 200

// `header`: contenido opcional que se queda FIJO bajo el título (ej. la barra de
// búsqueda de Select) — solo `children` hace scroll (v0.9.726).
export function BottomSheet({ open, title, onClose, header, children }) {
  const [mounted, setMounted] = useState(open)
  const panelRef = useRef(null)
  useBackClose(open, () => onClose?.())
  useScrollLock(open)
  useEffect(() => {
    if (open) { setMounted(true); return }
    const id = setTimeout(() => setMounted(false), EXIT_MS)
    return () => clearTimeout(id)
  }, [open])
  // Al abrir, deja a la vista la opción marcada con data-selected (si la hay)
  useEffect(() => {
    if (!open || !mounted) return
    const id = setTimeout(() => scrollSelectedIntoView(panelRef.current), 30)
    return () => clearTimeout(id)
  }, [open, mounted])
  if (!mounted) return null
  return createPortal(
    <div className={`${styles.overlay} ${open ? '' : styles.exiting}`} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div ref={panelRef} className={`${styles.panel} ${open ? '' : styles.panelExiting}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.handle} />
        {title && <div className={styles.title}>{title}</div>}
        {header}
        <div className={styles.scroll}>{children}</div>
      </div>
    </div>,
    document.body
  )
}
