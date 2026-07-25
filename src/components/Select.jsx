import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import styles from './Select.module.css'

// Reemplaza el <select> nativo del sistema por un desplegable con el mismo
// estilo del resto de la app (fondo oscuro, radius 5, highlight en
// var(--accent) para lo seleccionado) — nada elaborado, solo que no rompa
// con el branding cuando se abre.
//
// `renderIcon(option)` es opcional: si se pasa, antepone ese nodo a cada
// opción (usado para categorías, donde cada una trae su ícono en su propio
// color, igual que en "Por Categoría" de Pagos).
export function Select({ value, onChange, options, placeholder, renderIcon }) {
  const [open, setOpen] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function toggleOpen() {
    if (!open && ref.current) {
      // Regla nueva (v0.9.252, confirmada por Johnatan): el desplegable
      // siempre abre hacia donde haya MÁS espacio disponible, comparando
      // arriba contra abajo — no un umbral fijo de "cabe o no cabe" como
      // antes (`spaceBelow < PANEL_HEIGHT`). Aplica a TODOS los <Select> de
      // la app (PaymentModal.jsx incluido), es este único componente el que
      // decide la dirección.
      const rect = ref.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      setDropUp(spaceAbove > spaceBelow)
    }
    setOpen(v => !v)
  }

  return (
    <div ref={ref} className={styles.wrapper}>
      <button
        type="button"
        onClick={toggleOpen}
        className={`field-input ${styles.trigger}`}
      >
        <span className={styles.triggerContent}>
          {renderIcon && value && renderIcon(value)}
          <span className={`${styles.triggerText} ${value ? styles.triggerTextFilled : styles.triggerTextPlaceholder}`}>{value || placeholder || 'Selecciona'}</span>
        </span>
        <ChevronDown size={16} color="var(--text)" className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
      </button>

      {open && (
        <div className={`${styles.panel} ${dropUp ? styles.panelUp : styles.panelDown}`}>
          {options.map(opt => {
            const isSel = opt === value
            return (
              <button
                type="button"
                key={opt}
                onClick={() => { onChange(opt); setOpen(false) }}
                className={`${styles.option} ${isSel ? styles.optionSelected : ''}`}
              >
                {renderIcon && renderIcon(opt)}
                <span className={styles.optionText}>{opt}</span>
                {isSel && <Check size={14} color="var(--surface)" className={styles.checkIcon} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
