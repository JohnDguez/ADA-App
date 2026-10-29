import { useEffect, useId, useState } from 'react'
import styles from './PeriodGauge.module.css'

// Medidor semicircular "Avance del periodo" — mismo dibujo que el de escritorio
// (arco grueso, pendiente rayado, pagado azul profundo, vencido rojo, % al
// centro). Nació para el Inicio móvil (v0.9.885); desde v0.9.893 lo usa también
// el de escritorio (`large`).
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

// Geometría: el arco se alarga 13 px recto en cada extremo (el radio de la
// punta redonda del carril) y todos los tramos se recortan con la forma del
// carril. Así el achurado y los colores llegan hasta la punta redondeada en
// ambos extremos; antes terminaban en el punto medio de la punta y el carril
// sobresalía (v0.9.893).
const ARC = 'M 40 153 L 40 140 A 110 110 0 0 1 260 140 L 260 153'
const TRACK = 'M 40 140 A 110 110 0 0 1 260 140'
const EXT = 13
const ARC_LEN = Math.PI * 110
const TOTAL = ARC_LEN + 2 * EXT
const E = (EXT / TOTAL) * 100       // % del trazo largo que ocupa cada extensión
const K = ARC_LEN / TOTAL           // factor de % de arco → % de trazo largo
const at = (p) => E + K * p
// Tramo [a, b] (en % del arco) → dasharray/dashoffset sobre el trazo largo
function seg(a, b) {
  const from = a <= 0 ? 0 : at(a)
  const to = b >= 100 ? 100 : at(b)
  return { strokeDasharray: `${Math.max(0, to - from)} 200`, strokeDashoffset: -from }
}

// Azul con punta redonda: el trazo se acorta el radio de la punta (E) para que
// la punta —no el borde recto— caiga justo en el porcentaje.
function segCap(p) {
  if (p >= 100) return seg(0, 100)
  return { strokeDasharray: `${Math.max(0, at(p) - E)} 200`, strokeDashoffset: 0 }
}

export function PeriodGauge({ paidPct, overduePct = 0, empty = false, label, centerLabel, center, large = false }) {
  const uid = useId().replace(/:/g, '')
  let paidT = Math.max(0, Math.min(100, paidPct))
  let overT = Math.max(0, Math.min(100 - paidT, overduePct))
  // El % pagado llega redondeado y el vencido exacto: la diferencia (<1 %) no es
  // "pendiente", es redondeo. Se absorbe para que el anillo llegue al final.
  const gap = 100 - paidT - overT
  if (!empty && gap > 0 && gap < 1) { if (overT > 0) overT += gap; else paidT += gap }
  const paid = useGrow(paidT)
  const over = useGrow(overT)
  const pending = empty ? seg(0, 100) : seg(paid + over, 100)
  return (
    <div className={`${styles.wrap} ${large ? styles.large : ''}`} role="img" aria-label={label}>
      <svg viewBox="0 0 300 150" className={styles.svg} aria-hidden="true">
        <defs>
          <pattern id={`h${uid}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" className={styles.hatchLine} />
          </pattern>
          <pattern id={`o${uid}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" className={styles.hatchOn} />
          </pattern>
          <mask id={`m${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="170">
            <path d={TRACK} className={styles.maskShape} />
          </mask>
        </defs>
        <path d={TRACK} className={styles.track} />
        <g mask={`url(#m${uid})`}>
          <path d={ARC} pathLength="100" className={styles.pending} stroke={`url(#h${uid})`} {...pending} />
          {/* El rojo arranca desde el inicio y queda DETRÁS del azul: así la punta
              redondeada del azul se ve sobre el rojo. */}
          {!empty && overT > 0 && <path d={ARC} pathLength="100" className={styles.over} {...seg(0, paid + over)} />}
          {!empty && overT > 0 && <path d={ARC} pathLength="100" className={styles.tex} stroke={`url(#o${uid})`} {...seg(0, paid + over)} />}
          {!empty && paidT > 0 && <path d={ARC} pathLength="100" className={styles.paid} style={{ opacity: paid > 0.05 ? 1 : 0 }} {...segCap(paid)} />}
          {!empty && paidT > 0 && <path d={ARC} pathLength="100" className={`${styles.tex} ${styles.texCap}`} stroke={`url(#o${uid})`} style={{ opacity: paid > 0.05 ? undefined : 0 }} {...segCap(paid)} />}
        </g>
      </svg>
      <div className={styles.center}>
        {center || <><b>{Math.round(paid)}%</b><span>{centerLabel}</span></>}
      </div>
    </div>
  )
}
