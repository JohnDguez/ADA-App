import { useState, useRef } from 'react'
import { ChevronUp, GripHorizontal } from 'lucide-react'
import styles from './GoalsTray.module.css'

// Umbral de arrastre (px) para soltar y abrir Metas — pedido explícito de
// Johnatan: un gesto de arrastre real (seguir el dedo), no solo un toque
// que dispara la animación. Se deja también un tap simple como respaldo
// (si no hubo movimiento real), para no depender únicamente del gesto.
const OPEN_THRESHOLD = 40
const MAX_DRAG = 70

// Vive FUERA de BottomNav.jsx a propósito (Johnatan fue explícito: "la
// pestaña debe formar parte del Home, no es parte del navbar") — se
// renderiza en App.jsx como hermano de <BottomNav>, solo cuando
// tab === 'home'. Por eso NO se comparte fondo/silueta con el nav: es su
// propia bandeja de ancho completo, anclada al borde inferior real de la
// pantalla, con el nav (sin ningún cambio) flotando encima/adentro.
export function GoalsTray({ onOpen }) {
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startYRef = useRef(0)
  const movedRef = useRef(false)

  function start(y) {
    startYRef.current = y
    movedRef.current = false
    setDragging(true)
  }
  function move(y) {
    const delta = startYRef.current - y
    if (Math.abs(delta) > 4) movedRef.current = true
    setDragY(Math.max(0, Math.min(delta, MAX_DRAG)))
  }
  function end() {
    setDragging(false)
    if (dragY >= OPEN_THRESHOLD) onOpen()
    setDragY(0)
  }

  return (
    <div
      className={`${styles.tray} ${dragging ? styles.dragging : ''}`}
      style={dragY ? { transform: `translateY(-${dragY}px)` } : undefined}
      onTouchStart={e => start(e.touches[0].clientY)}
      onTouchMove={e => move(e.touches[0].clientY)}
      onTouchEnd={end}
      onClick={() => { if (!movedRef.current) onOpen() }}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
      aria-label="Mis metas — desliza hacia arriba para abrir"
    >
      <div className={styles.row}>
        <div className={styles.label}>
          <ChevronUp size={13} color="rgba(255,255,255,0.65)" />
          <span>Mis metas</span>
        </div>
        <GripHorizontal size={15} color="rgba(255,255,255,0.5)" />
      </div>
    </div>
  )
}
