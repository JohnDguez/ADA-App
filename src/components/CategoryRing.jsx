import { useEffect, useState } from 'react'
import { getCatColor } from '../lib/utils'
import styles from './CategoryRing.module.css'

// Medio anillo "Por categoría": mismo dibujo en escritorio y móvil (tramos
// gruesos con puntas redondeadas y separación entre ellos). Desde v0.9.902 vive
// aquí y, al montar, cada tramo crece desde 0 (Regla 53).
const RING = 'M 20 100 A 80 80 0 0 1 180 100'

export function CategoryRing({ cats, selectedCat, profile, totalAll, centerAmount, centerLabel, label }) {
  // Arranca sin dibujar y pasa al valor real en el siguiente cuadro para que
  // dispare la transición CSS del trazo.
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(raf)
  }, [])
  // pathLength=100: cada categoría es un tramo con puntas redondeadas. Se resta
  // el ancho de las puntas (≈3.4 por lado) para que no se encimen.
  // Los extremos del arco no llevan separación: el primer y el último tramo
  // llegan hasta donde llega la pista (v0.9.903); solo los cortes internos
  // descuentan el ancho de las puntas.
  const GAP = 3.4
  let off = 0
  const segs = cats.map(({ cat, total }, i) => {
    const len = totalAll > 0 ? (total / totalAll) * 100 : 0
    const lead = i === 0 ? 0 : GAP
    const trail = i === cats.length - 1 ? 0 : GAP
    const seg = { cat, len: Math.max(len - lead - trail, 0.01), start: off + lead, color: getCatColor(cat, profile.custom_categories, profile.category_colors) }
    off += len
    return seg
  })
  return (
    <div className={styles.ringWrap} role="img" aria-label={label}>
      <svg viewBox="0 0 200 106" className={styles.ringSvg} aria-hidden="true">
        <path d={RING} pathLength="100" className={styles.ringTrack} />
        {segs.map(sg => (
          <path key={sg.cat} d={RING} pathLength="100" className={styles.ringSeg} stroke={sg.color}
            strokeDasharray={`${grown ? sg.len.toFixed(2) : 0.01} 200`} strokeDashoffset={-sg.start}
            opacity={!selectedCat || selectedCat === sg.cat ? 1 : 0.25} />
        ))}
      </svg>
      <div className={styles.ringCenter}>
        <b>{centerAmount}</b>
        <span>{centerLabel}</span>
      </div>
    </div>
  )
}
