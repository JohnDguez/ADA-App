import { useEffect, useId, useState } from 'react'
import styles from './PeriodGauge.module.css'

// Medidor semicircular "Avance del periodo" — mismo dibujo que el de escritorio
// (arco grueso, pendiente rayado, pagado azul profundo, vencido rojo, % al
// centro). Nació para el Inicio móvil (v0.9.885, mockup B aprobado); el de
// escritorio (DeskHome.jsx) sigue con su copia propia.
// `center`: contenido propio para el hueco (ej. "Empieza en 6 días").
// Entrada animada: arranca en 0 y, al montar, pasa al valor real en el
// siguiente cuadro para que dispare la transición CSS del trazo; el número
// del centro cuenta junto con el arco. Si el valor cambia después, anima igual.
function useGrow(target, ms = 900) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(target); return }
    const from = v
    const t0 = performance.now()
    let raf = requestAnimationFrame(function step(now) {
      const k = Math.min(1, (now - t0) / ms)
      setV(from + (target - from) * (1 - Math.pow(1 - k, 3)))
      if (k < 1) raf = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, ms])
  return v
}

export function PeriodGauge({ paidPct, overduePct = 0, empty = false, label, centerLabel, center }) {
  const hatchId = useId().replace(/:/g, '')
  const arc = 'M 40 140 A 110 110 0 0 1 260 140'
  const paidT = Math.max(0, Math.min(100, paidPct))
  const overT = Math.max(0, Math.min(100 - paidT, overduePct))
  const paid = useGrow(paidT)
  const over = useGrow(overT)
  return (
    <div className={styles.wrap} role="img" aria-label={label}>
      <svg viewBox="0 0 300 150" className={styles.svg} aria-hidden="true">
        <defs>
          <pattern id={hatchId} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" className={styles.hatchLine} />
          </pattern>
        </defs>
        <path d={arc} pathLength="100" className={styles.track} />
        <path d={arc} pathLength="100" className={styles.pending} stroke={`url(#${hatchId})`}
          strokeDasharray={empty ? '100 100' : `${100 - paid - over} 100`} strokeDashoffset={empty ? 0 : -(paid + over)} />
        {!empty && paidT > 0 && <path d={arc} pathLength="100" className={styles.paid} style={{ opacity: paid > 0.05 ? 1 : 0 }} strokeDasharray={`${paid} 100`} />}
        {!empty && overT > 0 && <path d={arc} pathLength="100" className={styles.over} strokeDasharray={`${over} 100`} strokeDashoffset={-paid} />}
      </svg>
      <div className={styles.center}>
        {center || <><b>{Math.round(paid)}%</b><span>{centerLabel}</span></>}
      </div>
    </div>
  )
}
