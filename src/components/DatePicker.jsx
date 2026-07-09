import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react'
import { MONTHS, MONTHS_SHORT, WEEKDAYS_SHORT, dateOf, addMonths } from '../lib/utils'

function toStr(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function isSameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Alto estimado del panel abierto — usado para decidir si abre hacia abajo
// o hacia arriba según el espacio real disponible en pantalla. El modo
// "mes/año" es un poco más alto que el de días.
const PANEL_HEIGHT = 300

// Reemplaza el <input type="date"> nativo (la ventana del sistema) por un
// desplegable propio con el mismo estilo del resto de la app. El ícono de
// calendario ahora es grande y en var(--accent) — antes era el diminuto
// ícono gris que trae el navegador por defecto, casi invisible.
export function DatePicker({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const [mode, setMode] = useState('days') // 'days' | 'monthYear'
  const [viewDate, setViewDate] = useState(() => value ? dateOf(value) : new Date())
  const ref = useRef(null)

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  useEffect(() => {
    if (open) {
      setViewDate(value ? dateOf(value) : new Date())
      setMode('days')
    }
  }, [open])

  function toggleOpen() {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setDropUp(spaceBelow < PANEL_HEIGHT)
    }
    setOpen(v => !v)
  }

  const selected = value ? dateOf(value) : null
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const startWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const cells = []
  for (let i = startWeekday - 1; i >= 0; i--) cells.push({ day: daysInPrevMonth - i, muted: true, dateObj: new Date(year, month - 1, daysInPrevMonth - i) })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, muted: false, dateObj: new Date(year, month, d) })
  while (cells.length % 7 !== 0) {
    const n = cells.length - (startWeekday + daysInMonth) + 1
    cells.push({ day: n, muted: true, dateObj: new Date(year, month + 1, n) })
  }

  function pick(dateObj) { onChange(toStr(dateObj)); setOpen(false) }
  function pickMonth(m) { setViewDate(new Date(year, m, 1)); setMode('days') }

  const label = selected
    ? `${String(selected.getDate()).padStart(2, '0')}/${String(selected.getMonth() + 1).padStart(2, '0')}/${selected.getFullYear()}`
    : (placeholder || 'Selecciona una fecha')

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={toggleOpen}
        className="field-input"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', cursor: 'pointer' }}
      >
        <span style={{ color: selected ? 'var(--text)' : 'var(--muted)' }}>{label}</span>
        <Calendar size={20} color="var(--accent)" strokeWidth={2} style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', [dropUp ? 'bottom' : 'top']: '100%', left: 0, right: 0,
          [dropUp ? 'marginBottom' : 'marginTop']: 6,
          background: 'var(--menu-bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 60, padding: 12,
        }}>
          {mode === 'days' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <button type="button" onClick={() => setViewDate(addMonths(viewDate, -1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                  <ChevronLeft size={16} color="var(--text)" />
                </button>
                <button
                  type="button"
                  onClick={() => setMode('monthYear')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 5 }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{MONTHS[month]} {year}</span>
                  <ChevronDown size={13} color="var(--text)" />
                </button>
                <button type="button" onClick={() => setViewDate(addMonths(viewDate, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                  <ChevronRight size={16} color="var(--text)" />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, paddingBottom: 6, marginBottom: 6, borderBottom: '0.5px solid var(--border)' }}>
                {WEEKDAYS_SHORT.map((w, i) => (
                  <div key={w + i} style={{ textAlign: 'center', fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>{w[0]}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {cells.map((c, i) => {
                  const isSel = isSameDay(c.dateObj, selected)
                  return (
                    <button
                      type="button"
                      key={i}
                      onClick={() => pick(c.dateObj)}
                      style={{
                        textAlign: 'center', fontSize: 12, padding: '7px 0', border: 'none', borderRadius: 5,
                        background: isSel ? 'var(--accent)' : 'none',
                        color: isSel ? '#fff' : c.muted ? 'var(--border-mid)' : 'var(--text)',
                        fontWeight: isSel ? 600 : 400, cursor: 'pointer',
                      }}
                    >
                      {c.day}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <button type="button" onClick={() => setViewDate(new Date(year - 1, month, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                  <ChevronLeft size={16} color="var(--text)" />
                </button>
                <button
                  type="button"
                  onClick={() => setMode('days')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 5 }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{year}</span>
                  <ChevronUp size={13} color="var(--text)" />
                </button>
                <button type="button" onClick={() => setViewDate(new Date(year + 1, month, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                  <ChevronRight size={16} color="var(--text)" />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {MONTHS_SHORT.map((m, i) => {
                  const isSel = i === month
                  return (
                    <button
                      type="button"
                      key={m}
                      onClick={() => pickMonth(i)}
                      style={{
                        padding: '10px 0', border: 'none', borderRadius: 5, textAlign: 'center',
                        background: isSel ? 'var(--accent)' : 'var(--bg)',
                        color: isSel ? '#fff' : 'var(--text)',
                        fontSize: 12, fontWeight: isSel ? 600 : 400, cursor: 'pointer',
                        fontFamily: 'DM Sans, sans-serif',
                      }}
                    >
                      {m}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
