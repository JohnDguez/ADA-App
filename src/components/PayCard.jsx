import { RefreshCw } from 'lucide-react'
import { statusOf, daysDiff, dateOf, fmt, MONTHS, WEEKDAYS_SHORT, nextCobroDate } from '../lib/utils'

function badgeOf(p, cfg) {
  const s = statusOf(p, cfg)
  if (s === 'paid') return { cls: 'badge-paid', label: 'Pagado' }
  const d = daysDiff(p.due_date)
  if (s === 'overdue') return { cls: 'badge-due', label: 'Vencido' }
  if (s === 'cobro') {
    const nc = nextCobroDate(cfg)
    const t = new Date(); t.setHours(0,0,0,0)
    if (nc.getTime() === t.getTime()) return { cls: 'badge-cobro', label: 'Pagar hoy' }
    return { cls: 'badge-cobro', label: `Pagar este ${WEEKDAYS_SHORT[nc.getDay()]}` }
  }
  if (d === 0) return { cls: 'badge-soon', label: 'Hoy' }
  if (d === 1) return { cls: 'badge-soon', label: 'Mañana' }
  if (d <= 5) return { cls: 'badge-soon', label: `En ${d} días` }
  return { cls: 'badge-ok', label: `En ${d} días` }
}

function barColor(p, cfg) {
  const s = statusOf(p, cfg)
  if (s === 'paid') return '#C8C5BE'
  if (s === 'overdue' || s === 'cobro') return '#B83232'
  if (s === 'soon') return '#A06B12'
  return '#1E6B45'
}

export function PayCard({ payment: p, cfg, onClick }) {
  const b = badgeOf(p, cfg)
  const bar = barColor(p, cfg)
  const d = dateOf(p.due_date)

  return (
    <div className="pay-card" onClick={() => onClick(p)} style={{ background: '#fff', border: '0.5px solid #E4E2DC', borderRadius: 12, display: 'flex', overflow: 'hidden', cursor: 'pointer' }}>
      <div style={{ width: 4, flexShrink: 0, background: bar }} />
      <div style={{ flex: 1, padding: '11px 13px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1915', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 165 }}>
            {p.name}
          </span>
          {p.is_variable
            ? <span style={{ fontSize: 11, fontWeight: 500, color: '#A06B12', background: '#FEF3DC', padding: '2px 8px', borderRadius: 20 }}>Monto variable</span>
            : <span style={{ fontSize: 15, fontWeight: 600, color: '#1A1915' }}>{fmt(p.amount)}</span>
          }
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#5C5A55', display: 'flex', alignItems: 'center', gap: 4 }}>
            {p.category}
            {p.is_recurrent && <RefreshCw size={10} color="#5C5A55" />}
            {' '}· {d.getDate()} {MONTHS[d.getMonth()]}
          </span>
          <span className={`badge ${b.cls}`}>{b.label}</span>
        </div>
      </div>
    </div>
  )
}
