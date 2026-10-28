import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBackClose } from '../lib/backNav'
import styles from './BottomSheet.module.css'
import { useScrollLock } from '../lib/scrollLock'
import { scrollSelectedIntoView } from '../lib/scrollSelected'
import { useIsDesktop } from '../hooks/useIsDesktop'

// Escritorio (v0.9.837): en ≥1100px los selectores NO abren una hoja modal
// que oscurece la pantalla, sino un popover anclado al control que lo abrió
// (mismo patrón que los filtros de Exportar). El ancla se toma del último
// clic/pulsación (o del elemento con foco si se abrió con teclado). Las hojas
// que no son selectores pasan `modal` y se quedan como diálogo.
let lastTrigger = null
let lastTriggerAt = 0
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', e => {
    const el = e.target instanceof Element ? e.target : null
    lastTrigger = el ? (el.closest('button,[role=button],[role=radio],[role=combobox],input') || el) : null
    lastTriggerAt = Date.now()
  }, true)
}
export function resolveAnchor() {
  if (lastTrigger && document.contains(lastTrigger) && Date.now() - lastTriggerAt < 1500) return lastTrigger
  const a = document.activeElement
  return a && a !== document.body ? a : null
}
const POP_MAX_W = 380

// Hoja inferior reutilizable para los selectores del formulario de pago
// (categoría, fecha, método). Mantiene el contenido montado el tiempo de la
// animación de salida (Regla 29). EXIT_MS debe coincidir con la duración de
// `.exiting` / `.panelExiting` en BottomSheet.module.css (Regla 30).
const EXIT_MS = 200

// `header`: contenido opcional que se queda FIJO bajo el título (ej. la barra de
// búsqueda de Select) — solo `children` hace scroll (v0.9.726).
// `wide`: cuadrículas (categorías) — el popover de escritorio mide 420px en vez de 380.
export function BottomSheet({ open, title, onClose, header, children, modal = false, wide = false }) {
  const [mounted, setMounted] = useState(open)
  const panelRef = useRef(null)
  const desk = useIsDesktop()
  const anchorRef = useRef(null)
  if (open && !anchorRef.current) anchorRef.current = resolveAnchor()
  const popover = desk && !modal && !!anchorRef.current
  const [pos, setPos] = useState(null)
  useBackClose(open && !popover, () => onClose?.())
  useScrollLock(open && !popover)
  useEffect(() => {
    if (open) { setMounted(true); return }
    const id = setTimeout(() => { setMounted(false); anchorRef.current = null; setPos(null) }, EXIT_MS)
    return () => clearTimeout(id)
  }, [open])

  // Posición del popover: debajo del ancla (o arriba si abajo no cabe),
  // alineado a su borde izquierdo y sin salirse de la ventana.
  useLayoutEffect(() => {
    if (!open || !popover) return undefined
    function place() {
      const a = anchorRef.current
      if (!a || !document.contains(a)) return
      const r = a.getBoundingClientRect()
      const w = Math.min(Math.max(r.width, wide ? 420 : 300), wide ? 420 : POP_MAX_W)
      const left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12))
      const below = window.innerHeight - r.bottom - 20
      const above = r.top - 20
      const up = below < 300 && above > below
      const maxH = Math.max(220, Math.min(up ? above : below, 560))
      setPos({ left, width: w, maxH, up, top: up ? undefined : r.bottom + 10, bottom: up ? window.innerHeight - r.top + 10 : undefined, arrow: Math.max(18, Math.min(r.left + r.width / 2 - left, w - 30)) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, popover])

  // Cierra con clic fuera o Esc (el clic en el ancla lo maneja su propio botón).
  useEffect(() => {
    if (!open || !popover) return undefined
    const onDown = e => {
      if (panelRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return
      onClose?.()
    }
    const onKey = e => { if (e.key === 'Escape') onClose?.() }
    // Volver a pulsar el control que abrió el popover lo cierra. El clic se
    // detiene en el propio control para que su manejador no lo reabra.
    const anchor = anchorRef.current
    const onAnchorClick = e => { e.stopPropagation(); onClose?.() }
    anchor?.addEventListener('click', onAnchorClick)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { anchor?.removeEventListener('click', onAnchorClick); document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, popover, onClose])
  // Al abrir, deja a la vista la opción marcada con data-selected (si la hay)
  useEffect(() => {
    if (!open || !mounted) return
    const id = setTimeout(() => scrollSelectedIntoView(panelRef.current), 30)
    return () => clearTimeout(id)
  }, [open, mounted])
  if (!mounted) return null
  if (popover) {
    if (!pos) return null
    return createPortal(
      <div ref={panelRef} role="dialog" aria-label={title}
        className={`${styles.pop} ${pos.up ? styles.popUp : ''} ${open ? '' : styles.popExiting}`}
        style={{ left: pos.left, width: pos.width, maxHeight: pos.maxH, top: pos.top, bottom: pos.bottom, '--arrow': `${pos.arrow}px` }}>
        {title && <div className={styles.popTitle}>{title}</div>}
        {header}
        <div className={styles.popScroll}>{children}</div>
      </div>,
      document.body
    )
  }
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
