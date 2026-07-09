import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

const PANEL_HEIGHT = 240

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
      const rect = ref.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setDropUp(spaceBelow < PANEL_HEIGHT)
    }
    setOpen(v => !v)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={toggleOpen}
        className="field-input"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', cursor: 'pointer' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {renderIcon && value && renderIcon(value)}
          <span style={{ color: value ? 'var(--text)' : 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || placeholder || 'Selecciona'}</span>
        </span>
        <ChevronDown size={16} color="var(--text)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', [dropUp ? 'bottom' : 'top']: '100%', left: 0, right: 0,
          [dropUp ? 'marginBottom' : 'marginTop']: 6,
          background: 'var(--menu-bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 60, maxHeight: 240, overflowY: 'auto',
        }}>
          {options.map(opt => {
            const isSel = opt === value
            return (
              <button
                type="button"
                key={opt}
                onClick={() => { onChange(opt); setOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', background: isSel ? 'var(--accent)' : 'none', border: 'none',
                  fontSize: 13, fontWeight: isSel ? 600 : 400, color: isSel ? '#fff' : 'var(--text)',
                  fontFamily: 'DM Sans, sans-serif', textAlign: 'left', cursor: 'pointer',
                }}
              >
                {renderIcon && renderIcon(opt)}
                <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt}</span>
                {isSel && <Check size={14} color="#fff" style={{ flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
