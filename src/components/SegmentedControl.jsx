import { useState, useRef, useLayoutEffect } from 'react'
import styles from './SegmentedControl.module.css'

// Segmentado con fondo que se desliza al cambiar de opción (v0.9.486 — Mis
// tarjetas: crédito/débito, red, física/digital). Regla 13: el pill solo
// se permite en segmentados. `options`: [{ value, label, icon? }].
export function SegmentedControl({ value, options, onChange, disabled = false }) {
  const refs = useRef({})
  const [thumb, setThumb] = useState(null)
  useLayoutEffect(() => {
    const el = refs.current[value]
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth })
  }, [value, options.length, options.map(o => o.label).join('|')])
  return (
    <div className={`${styles.seg} ${disabled ? styles.segDisabled : ''}`}>
      {thumb && <span className={styles.segThumb} style={{ '--seg-left': `${thumb.left}px`, '--seg-width': `${thumb.width}px` }} />}
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          ref={el => { refs.current[o.value] = el }}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`${styles.segOption} ${value === o.value ? styles.segOptionOn : ''}`}
        >
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  )
}
