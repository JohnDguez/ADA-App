import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Check, Pencil, Trash2, Clock, ChevronDown, ChevronUp, RotateCcw, FastForward } from 'lucide-react'
import { statusOf, daysDiff, dateOf, fmt, MONTHS_SHORT, WEEKDAYS_SHORT, nextCobroDate, periodLabel, periodCountLabel, RECUR_FREQ, installmentLabel } from '../lib/utils'

function badgeOf(p, cfg) {
  const s = statusOf(p, cfg)
  if (s === 'postponed') return { cls: 'badge-paused', label: 'Pospuesto' }
  if (s === 'paid')      return { cls: 'badge-paid',   label: p.is_installment ? installmentLabel(p) + ' ✓' : 'Pagado' }
  if (s === 'paused')    return { cls: 'badge-paused', label: 'Pausado' }
  const d = daysDiff(p.due_date)
  if (s === 'overdue')   return { cls: 'badge-due',    label: 'Vencido' }
  if (s === 'cobro') {
    if (d < 0) return { cls: 'badge-due', label: `Vencido hace ${Math.abs(d)} día${Math.abs(d) !== 1 ? 's' : ''}` }
    const nc = nextCobroDate(cfg)
    const t = new Date(); t.setHours(0,0,0,0)
    const base = p.is_installment ? installmentLabel(p) : (nc.getTime() === t.getTime() ? 'Pagar hoy' : `Pagar este ${WEEKDAYS_SHORT[nc.getDay()]}`)
    return { cls: 'badge-cobro', label: base }
  }
  const base = p.is_installment ? installmentLabel(p) : (d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : `En ${d} días`)
  return { cls: d <= 2 ? 'badge-soon' : 'badge-ok', label: base }
}

function barColor(p, cfg) {
  const s = statusOf(p, cfg)
  if (s === 'postponed' || s === 'paid' || s === 'paused') return 'var(--border-mid)'
  if (s === 'overdue') return 'var(--danger)'
  if (s === 'cobro') { return daysDiff(p.due_date) < 0 ? 'var(--danger)' : 'var(--danger)' }
  if (s === 'soon') return 'var(--warning)'
  return 'var(--paid)'
}

export function PayCard({ payment: p, cfg, onMarkPaid, onMarkUnpaid, onEdit, onDelete, onPostpone, onAdvance }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const b = badgeOf(p, cfg)
  const bar = barColor(p, cfg)
  const d = dateOf(p.due_date)
  const isPending = !p.is_paid && !p.postponed && !p.paused

  useEffect(() => {
    function handle(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    if (menuOpen) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuOpen])

  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', overflow: 'visible', position: 'relative' }}>
      <div style={{ width: 4, flexShrink: 0, background: bar, borderRadius: 'var(--radius) 0 0 var(--radius)' }} />
      <div style={{ flex: 1, padding: '11px 8px 11px 13px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 155 }}>{p.name}</span>
          {p.is_variable && !p.is_paid
            ? <span className="badge badge-soon">Variable</span>
            : <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{fmt(p.amount)}</span>
          }
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            {p.category} · {d.getDate()} {MONTHS_SHORT[d.getMonth()]}
            {p.is_recurrent && p.recur_freq && !p.is_installment && <span style={{ color: 'var(--accent)' }}> · {RECUR_FREQ[p.recur_freq]}</span>}
          </span>
          <span className={`badge ${b.cls}`}>{b.label}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px 0 4px', flexShrink: 0 }}>
        {isPending && (
          <button onClick={() => onMarkPaid(p)} style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--paid)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Check size={15} color="#fff" strokeWidth={2.5} />
          </button>
        )}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(v => !v)} style={{ width: 30, height: 30, borderRadius: '50%', background: 'none', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <MoreVertical size={14} color="var(--muted)" />
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', right: 0, top: 34, background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50, minWidth: 170, overflow: 'hidden' }}>
              {isPending && <MenuItem icon={<Pencil size={14}/>} label="Editar" onClick={() => { onEdit(p); setMenuOpen(false) }} />}
              {isPending && p.is_recurrent && !p.is_installment && <MenuItem icon={<Clock size={14}/>} label="Posponer" onClick={() => { onPostpone(p); setMenuOpen(false) }} />}
              {isPending && p.is_installment && onAdvance && <MenuItem icon={<FastForward size={14}/>} label="Adelantar pago" onClick={() => { onAdvance(p); setMenuOpen(false) }} />}
              {p.is_paid && <MenuItem icon={<RotateCcw size={14}/>} label="Marcar no pagado" onClick={() => { onMarkUnpaid(p.id); setMenuOpen(false) }} />}
              <MenuItem icon={<Trash2 size={14}/>} label="Eliminar" onClick={() => { onDelete(p.id); setMenuOpen(false) }} danger />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--bg)', fontSize: 13, fontWeight: 500, color: danger ? 'var(--danger)' : 'var(--text)', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', textAlign: 'left' }}>
      <span style={{ color: danger ? 'var(--danger)' : 'var(--muted)' }}>{icon}</span>{label}
    </button>
  )
}

export function GroupCard({ group, cfg, onMarkPaid, onMarkUnpaid, onEdit, onDelete, onPostpone, onAdvance }) {
  const [expanded, setExpanded] = useState(false)
  const allItems = [group, ...group._children]
  const paidItems = allItems.filter(p => p.is_paid)
  const totalPaid = paidItems.reduce((a, p) => a + Number(p.amount), 0)
  const freq = group.recur_freq || 'monthly'
  const freqLabel = RECUR_FREQ[freq] || ''
  const isPending = !group.is_paid && !group.postponed && !group.paused
  const countLabel = group.is_installment
    ? `${paidItems.length}/${group.total_installments} pagos`
    : periodCountLabel(paidItems.length, freq) + ' pagadas'

  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'visible' }}>
      <div style={{ display: 'flex', overflow: 'visible' }}>
        <div style={{ width: 4, flexShrink: 0, background: 'var(--paid)', borderRadius: expanded ? 'var(--radius) 0 0 0' : 'var(--radius) 0 0 var(--radius)' }} />
        <div style={{ flex: 1, padding: '11px 8px 11px 13px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{group.name}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{totalPaid > 0 ? fmt(totalPaid) : '—'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{freqLabel}</span>
            {paidItems.length > 0 && <span className="badge badge-paid">{countLabel}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px 0 4px', flexShrink: 0 }}>
          {isPending && (
            <button onClick={() => onMarkPaid(group)} style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--paid)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Check size={15} color="#fff" strokeWidth={2.5} />
            </button>
          )}
          <button onClick={() => setExpanded(v => !v)} style={{ width: 30, height: 30, borderRadius: '50%', background: 'none', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {expanded ? <ChevronUp size={14} color="var(--muted)" /> : <ChevronDown size={14} color="var(--muted)" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '0.5px solid var(--border)' }}>
          {allItems.map((p, i) => {
            const overdue = daysDiff(p.due_date) < 0 && !p.is_paid
            const isPend = !p.is_paid && !p.postponed
            const isLast = i === allItems.length - 1
            const instLabel = p.is_installment ? `Pago ${p.current_installment}/${p.total_installments}` : periodLabel(p.due_date, freq)
            const badgeCls = p.is_paid ? 'badge-paid' : p.postponed ? 'badge-paused' : overdue ? 'badge-due' : 'badge-soon'
            const badgeText = p.is_paid ? 'Pagado' : p.postponed ? 'Pospuesto' : overdue ? 'Vencido' : 'Pendiente'
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '9px 12px 9px 20px', borderBottom: isLast ? 'none' : '0.5px solid var(--bg)', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: overdue ? 'var(--danger)' : p.is_paid ? 'var(--border-mid)' : 'var(--paid)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>{instLabel}</span>
                {p.amount > 0 && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{fmt(p.amount)}</span>}
                <span className={`badge ${badgeCls}`}>{badgeText}</span>
                {isPend && (
                  <button onClick={() => onMarkPaid(p)} style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--paid)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <Check size={10} color="#fff" strokeWidth={2.5} />
                  </button>
                )}
                {isPend && p.is_recurrent && !p.is_installment && (
                  <button onClick={() => onPostpone(p)} style={{ width: 22, height: 22, borderRadius: '50%', background: 'none', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <Clock size={10} color="var(--muted)" />
                  </button>
                )}
                {p.is_paid && (
                  <button onClick={() => onMarkUnpaid(p.id)} style={{ width: 22, height: 22, borderRadius: '50%', background: 'none', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <RotateCcw size={10} color="var(--muted)" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
