import { useState, useRef } from 'react'
import { ChevronUp } from 'lucide-react'
import styles from './GoalsTray.module.css'

// Umbral de arrastre (px) para soltar y abrir Metas — gesto de arrastre
// real (sigue el dedo), con un tap simple de respaldo si no hubo
// movimiento real (`movedRef`).
const OPEN_THRESHOLD = 40
const MAX_DRAG = 70

// Vive FUERA de BottomNav.jsx a propósito — hermano de <BottomNav> en
// App.jsx, solo en Home. Fondo del mismo color que la página (var(--bg)),
// no azul del nav — la sombra hacia arriba es lo que la separa
// visualmente del contenido, no un color distinto.
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
          <ChevronUp size={13} color="var(--muted)" />
          <span>Mis metas</span>
        </div>
        <div className={styles.dragLine} />
      </div>
    </div>
  )
}
