import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBackClose } from '../lib/backNav'
import styles from './BottomSheet.module.css'
import { useScrollLock } from '../lib/scrollLock'

// Hoja inferior reutilizable para los selectores del formulario de pago
// (categoría, fecha, método). Mantiene el contenido montado el tiempo de la
// animación de salida (Regla 29). EXIT_MS debe coincidir con la duración de
// `.exiting` / `.panelExiting` en BottomSheet.module.css (Regla 30).
const EXIT_MS = 200

export function BottomSheet({ open, title, onClose, children }) {
  const [mounted, setMounted] = useState(open)
  useBackClose(open, () => onClose?.())
  useScrollLock(open)
  useEffect(() => {
    if (open) { setMounted(true); return }
    const id = setTimeout(() => setMounted(false), EXIT_MS)
    return () => clearTimeout(id)
  }, [open])
  if (!mounted) return null
  return createPortal(
    <div className={`${styles.overlay} ${open ? '' : styles.exiting}`} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className={`${styles.panel} ${open ? '' : styles.panelExiting}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.handle} />
        {title && <div className={styles.title}>{title}</div>}
        {children}
      </div>
    </div>,
    document.body
  )
}
