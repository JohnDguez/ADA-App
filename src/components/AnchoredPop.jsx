import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePresence } from '../lib/usePresence'
import { resolveAnchor } from './BottomSheet'
import styles from './AnchoredPop.module.css'

// Popover de escritorio (v0.9.855) para formularios cortos: se ancla al
// botón que lo abrió (el último clic), con flecha, y se cierra con clic fuera
// o Esc. Mismo patrón visual que los popovers de BottomSheet/Exportar, pero
// con contenido libre. Entra y sale con animación (Regla 29; EXIT_MS en
// usePresence debe coincidir con `.popOut` en el CSS — Regla 30).
// `anchorRef` lo comparte con quien lo usa para saber si hay ancla: si no la
// hay (apertura por código), quien llama cae al modal centrado.
export function useAnchor(open) {
  const ref = useRef(null)
  const was = useRef(false)
  // Se resuelve al pasar de cerrado a abierto; al cerrar se conserva para la animación de salida.
  if (open && !was.current) ref.current = resolveAnchor()
  was.current = !!open
  return ref
}

export function AnchoredPop({ open, onClose, anchorRef, width = 420, label, children }) {
  const { render, closing } = usePresence(open)
  const panelRef = useRef(null)
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    if (!render) return undefined
    function place() {
      const a = anchorRef.current
      if (!a || !document.contains(a)) return
      const r = a.getBoundingClientRect()
      const w = Math.min(width, window.innerWidth - 24)
      // Centrado bajo el botón, sin salirse de la ventana.
      const left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 12))
      const below = window.innerHeight - r.bottom - 20
      const above = r.top - 20
      const up = below < 380 && above > below
      const maxH = Math.max(260, Math.min(up ? above : below, 700))
      setPos({
        left, width: w, maxH, up,
        top: up ? undefined : r.bottom + 10,
        bottom: up ? window.innerHeight - r.top + 10 : undefined,
        arrow: Math.max(26, Math.min(r.left + r.width / 2 - left, w - 26)),
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [render, width, anchorRef])

  useEffect(() => {
    if (!open) return undefined
    const anchor = anchorRef.current
    const onDown = e => {
      const t = e.target
      if (panelRef.current?.contains(t) || anchor?.contains(t)) return
      // Un selector o formulario abierto desde dentro (método de pago,
      // nueva tarjeta) vive en otro diálogo: no cuenta como "fuera".
      const dlg = t instanceof Element ? t.closest('[role="dialog"]') : null
      if (dlg && dlg !== panelRef.current) return
      onClose?.()
    }
    const onKey = e => { if (e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]')) onClose?.() }
    // Volver a pulsar el botón que lo abrió lo cierra.
    const onAnchorClick = e => { e.stopPropagation(); onClose?.() }
    anchor?.addEventListener('click', onAnchorClick)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      anchor?.removeEventListener('click', onAnchorClick)
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, anchorRef])

  if (!render || !pos) return null
  return createPortal(
    <div ref={panelRef} role="dialog" aria-label={label}
      className={`${styles.pop} ${pos.up ? styles.popUp : ''} ${closing ? styles.popOut : ''}`}
      style={{ left: pos.left, width: pos.width, maxHeight: pos.maxH, top: pos.top, bottom: pos.bottom, '--arrow': `${pos.arrow}px` }}>
      <div className={styles.scroll}>{children}</div>
    </div>,
    document.body
  )
}
