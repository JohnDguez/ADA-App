import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { MONTHS, WEEKDAYS_SHORT, dateOf, addMonths } from '../lib/utils'

function toStr(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function isSameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Reemplaza el <input type="date"> nativo (la ventana del sistema) por un
// desplegable propio con el mismo estilo del resto de la app. El ícono de
// calendario ahora es grande y en var(--accent) — antes era el diminuto
// ícono gris que trae el navegador por defecto, casi invisible.
export function DatePicker({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => value ? dateOf(value) : new Date())
  const ref = useRef(null)

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  useEffect(() => { if (open) setViewDate(value ? dateOf(value) : new Date()) }, [open])

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

  const label = selected
    ? `${String(selected.getDate()).padStart(2, '0')}/${String(selected.getMonth() + 1).padStart(2, '0')}/${selected.getFullYear()}`
    : (placeholder || 'Selecciona una fecha')

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="field-input"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', cursor: 'pointer' }}
      >
        <span style={{ color: selected ? 'var(--text)' : 'var(--muted)' }}>{label}</span>
        <Calendar size={20} color="var(--accent)" strokeWidth={2} style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, background: 'var(--menu-bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 60, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" onClick={() => setViewDate(addMonths(viewDate, -1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
              <ChevronLeft size={16} color="var(--text)" />
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{MONTHS[month]} {year}</span>
            <button type="button" onClick={() => setViewDate(addMonths(viewDate, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
              <ChevronRight size={16} color="var(--text)" />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {WEEKDAYS_SHORT.map(w => (
              <div key={w} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text)', fontWeight: 500 }}>{w[0]}</div>
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
        </div>
      )}
    </div>
  )
}
