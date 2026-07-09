import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

// Reemplaza el <select> nativo del sistema por un desplegable con el mismo
// estilo del resto de la app (fondo oscuro, radius 5, highlight en
// var(--accent) para lo seleccionado) — nada elaborado, solo que no rompa
// con el branding cuando se abre.
export function Select({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="field-input"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', cursor: 'pointer' }}
      >
        <span style={{ color: value ? 'var(--text)' : 'var(--muted)' }}>{value || placeholder || 'Selecciona'}</span>
        <ChevronDown size={16} color="var(--text)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, background: 'var(--menu-bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 60, maxHeight: 240, overflowY: 'auto' }}>
          {options.map(opt => {
            const isSel = opt === value
            return (
              <button
                type="button"
                key={opt}
                onClick={() => { onChange(opt); setOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', background: isSel ? 'var(--accent)' : 'none', border: 'none',
                  fontSize: 13, fontWeight: isSel ? 600 : 400, color: isSel ? '#fff' : 'var(--text)',
                  fontFamily: 'DM Sans, sans-serif', textAlign: 'left', cursor: 'pointer',
                }}
              >
                {opt}
                {isSel && <Check size={14} color="#fff" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
