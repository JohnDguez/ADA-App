import { useLayoutEffect, useRef, useState } from 'react'
import styles from './StickyPanel.module.css'

const STICK_TOP = 16

/**
 * Sustituto manual de `position: sticky` para el panel de detalle de
 * Home — sticky nativo no funcionó de forma confiable en este layout
 * pese a 2 intentos por CSS (v0.9.368 quitar `overflow:hidden` del
 * contenedor, v0.9.370 arreglar el `overflow-x` implícito de
 * html/body/#root) — Johnatan confirmó en vivo que seguía sin pegarse
 * incluso con el fix de v0.9.370. En vez de seguir cazando la causa por
 * CSS, se calcula la posición a mano en cada scroll/resize.
 *
 * `boundaryRef`: el elemento cuyo borde inferior marca dónde "se suelta"
 * el panel — en Home es `.masterColumn` (el maestro). Sin esto, el panel
 * se quedaría flotando más allá del final de la lista de pagos.
 */
export function StickyPanel({ boundaryRef, children }) {
  const outerRef = useRef(null)
  const contentRef = useRef(null)
  const [stuck, setStuck] = useState(null) // null (flujo normal) | { top, left, width }

  useLayoutEffect(() => {
    function update() {
      const outer = outerRef.current
      const content = contentRef.current
      const boundary = boundaryRef.current
      if (!outer || !content || !boundary) return

      const outerRect = outer.getBoundingClientRect()
      const boundaryBottom = boundary.getBoundingClientRect().bottom
      const contentHeight = content.offsetHeight

      // Si el panel, en su posición NATURAL (sin fijar), ya estaría más
      // abajo del punto donde se pegaría (STICK_TOP), todavía no le toca
      // fijarse — flujo normal.
      if (outerRect.top >= STICK_TOP) {
        setStuck(null)
        return
      }

      // Dónde debería fijarse: STICK_TOP, a menos que el maestro ya esté
      // por terminar — ahí se "suelta" siguiendo el borde inferior del
      // maestro en vez de quedarse fijo más allá de la lista. Al seguir
      // moviéndose 1:1 con el scroll una vez pegado al fondo, esto se
      // resuelve solo (no hace falta un tercer estado): sigue
      // subiendo/bajando como cualquier elemento normal, solo que
      // anclado al borde del maestro en vez de al viewport.
      const top = Math.min(STICK_TOP, boundaryBottom - contentHeight)

      if (top <= outerRect.top) {
        // Ya pasamos por completo la zona donde hacía falta fijarlo.
        setStuck(null)
        return
      }

      setStuck({ top, left: outerRect.left, width: outerRect.width })
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [boundaryRef])

  return (
    <div ref={outerRef} className={styles.outer}>
      {/* Placeholder — reserva el espacio en el flujo mientras el
          contenido real está en position:fixed, para que .outer no se
          colapse a altura 0 (eso rompería la medición del scroll). */}
      {stuck && <div style={{ height: contentRef.current?.offsetHeight }} />}
      <div
        ref={contentRef}
        className={`${styles.content} ${stuck ? styles.contentFixed : ''}`}
        style={stuck ? { top: stuck.top, left: stuck.left, width: stuck.width } : undefined}
      >
        {children}
      </div>
    </div>
  )
}
