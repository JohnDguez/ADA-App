import { useId } from 'react'
import styles from './PeriodGauge.module.css'

// Medidor semicircular "Avance del periodo" — mismo dibujo que el de escritorio
// (arco grueso, pendiente rayado, pagado azul profundo, vencido rojo, % al
// centro). Nació para el Inicio móvil (v0.9.885, mockup B aprobado); el de
// escritorio (DeskHome.jsx) sigue con su copia propia.
// `center`: contenido propio para el hueco (ej. "Empieza en 6 días").
export function PeriodGauge({ paidPct, overduePct = 0, empty = false, label, centerLabel, center }) {
  const hatchId = useId().replace(/:/g, '')
  const arc = 'M 40 140 A 110 110 0 0 1 260 140'
  const paid = Math.max(0, Math.min(100, paidPct))
  const over = Math.max(0, Math.min(100 - paid, overduePct))
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
        {!empty && paid > 0 && <path d={arc} pathLength="100" className={styles.paid} strokeDasharray={`${paid} 100`} />}
        {!empty && over > 0 && <path d={arc} pathLength="100" className={styles.over} strokeDasharray={`${over} 100`} strokeDashoffset={-paid} />}
      </svg>
      <div className={styles.center}>
        {center || <><b>{Math.round(paidPct)}%</b><span>{centerLabel}</span></>}
      </div>
    </div>
  )
}
