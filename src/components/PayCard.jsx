import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Check, Pencil, Trash2, Clock, ChevronDown, ChevronUp, RotateCcw, FastForward } from 'lucide-react'
import { statusOf, daysDiff, dateOf, fmt, MONTHS_SHORT, periodLabel, periodCountLabel, RECUR_FREQ, installmentLabel } from '../lib/utils'

function statusInfo(p, cfg) {
  const s = statusOf(p, cfg)
  if (s === 'postponed') return { label: 'Pospuesto', color: 'var(--muted)' }
  if (s === 'paid')      return { label: p.is_installment ? installmentLabel(p) + ' ✓' : 'Pagado', color: 'var(--paid)' }
  if (s === 'paused')    return { label: 'Pausado', color: 'var(--muted)' }
  const d = daysDiff(p.due_date)
  if (s === 'overdue') return { label: d === -1 ? 'Venció ayer' : `Venció hace ${Math.abs(d)} días`, color: 'var(--danger)' }
  if (s === 'cobro') {
    if (d < 0) return { label: `Venció hace ${Math.abs(d)} días`, color: 'var(--danger)' }
    return { label: d === 0 ? 'Vence hoy' : `Vence en ${d} día${d !== 1 ? 's' : ''}`, color: 'var(--soon-color)' }
  }
  if (d === 0) return { label: 'Vence hoy',     color: 'var(--soon-color)' }
  if (d === 1) return { label: 'Vence mañana',  color: 'var(--soon-color)' }
  return { label: `Vence en ${d} días`, color: 'var(--accent)' }
}

function useLongPress(callback, ms = 500) {
  const timerRef = useRef(null)
  function start(e) { e.preventDefault(); timerRef.current = setTimeout(() => { callback(); timerRef.current = null }, ms) }
  function stop()  { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null } }
  return { onMouseDown: start, onMouseUp: stop, onMouseLeave: stop, onTouchStart: start, onTouchEnd: stop, onTouchCancel: stop }
}

export function PayCard({ payment: p, cfg, onMarkPaid, onMarkUnpaid, onEdit, onDelete, onPostpone, onAdvance, borderLeft }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const info      = statusInfo(p, cfg)
  const d         = dateOf(p.due_date)
  const isPending = !p.is_paid && !p.postponed && !p.paused
  const freqLabel = p.is_recurrent && p.recur_freq && !p.is_installment ? RECUR_FREQ[p.recur_freq] : null
  const instLabel = p.is_installment ? `Pago ${p.current_installment}/${p.total_installments}` : null

  const longPress = useLongPress(() => setMenuOpen(true))

  useEffect(() => {
    function handle(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    if (menuOpen) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuOpen])

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <div
        {...longPress}
        style={{ background: 'var(--surface)', borderRadius: 8, borderLeft: `5px solid ${borderLeft || 'var(--border)'}`, display: 'flex', alignItems: 'center', overflow: 'hidden', userSelect: 'none' }}
      >
        {/* Info izquierda */}
        <div style={{ flex: 1, padding: '11px 8px 11px 12px', minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>
            {p.name}
          </div>
          <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)' }}>
            {p.category} · {d.getDate()} {MONTHS_SHORT[d.getMonth()]}
          </div>
          {freqLabel && (
            <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500, marginTop: 1 }}>{freqLabel}</div>
          )}
          {instLabel && (
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)', marginTop: 1 }}>{instLabel}</div>
          )}
        </div>

        {/* Monto + estado */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, padding: '11px 8px', flexShrink: 0 }}>
          {p.is_variable && !p.is_paid
            ? <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: 'var(--label-variable)', padding: '2px 8px', borderRadius: 5 }}>Pago variable</div>
            : <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{fmt(p.amount)}</div>
          }
          <div style={{ fontSize: 11, fontWeight: 500, color: info.color }}>{info.label}</div>
        </div>

        {/* Botones derecha */}
        <div style={{ padding: '8px 6px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {isPending && (
            <button
              onClick={e => { e.stopPropagation(); onMarkPaid(p) }}
              style={{ width: 40, height: 40, background: 'var(--paid)', border: 'none', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <Check size={18} color="#fff" strokeWidth={2.5} />
            </button>
          )}
          {p.is_paid && (
            <div style={{ width: 40, height: 40, background: 'var(--paid)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={18} color="#fff" strokeWidth={2.5} />
            </div>
          )}
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
            style={{ width: 24, height: 24, borderRadius: '50%', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
          >
            <MoreVertical size={15} color="var(--text)" />
          </button>
        </div>
      </div>

      {/* Menú contextual */}
      {menuOpen && (
        <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 180, overflow: 'hidden' }}>
          {isPending && <MenuItem icon={<Pencil size={14}/>} label="Editar" onClick={() => { onEdit(p); setMenuOpen(false) }} />}
          {isPending && p.is_recurrent && !p.is_installment && <MenuItem icon={<Clock size={14}/>} label="Posponer" onClick={() => { onPostpone(p); setMenuOpen(false) }} />}
          {isPending && p.is_installment && onAdvance && <MenuItem icon={<FastForward size={14}/>} label="Adelantar pago" onClick={() => { onAdvance(p); setMenuOpen(false) }} />}
          {p.is_paid && <MenuItem icon={<RotateCcw size={14}/>} label="Marcar no pagado" onClick={() => { onMarkUnpaid(p.id); setMenuOpen(false) }} />}
          <MenuItem icon={<Trash2 size={14}/>} label="Eliminar" onClick={() => { onDelete(p.id); setMenuOpen(false) }} danger />
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--bg)', fontSize: 13, fontWeight: 500, color: danger ? 'var(--danger)' : 'var(--text)', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', textAlign: 'left' }}>
      <span style={{ color: danger ? 'var(--danger)' : 'var(--text)' }}>{icon}</span>{label}
    </button>
  )
}

export function GroupCard({ group, cfg, onMarkPaid, onMarkUnpaid, onEdit, onDelete, onPostpone, onAdvance }) {
  const [expanded, setExpanded] = useState(false)
  const allItems  = [group, ...group._children]
  const paidItems = allItems.filter(p => p.is_paid)
  const totalPaid = paidItems.reduce((a, p) => a + Number(p.amount), 0)
  const freq      = group.recur_freq || 'monthly'
  const freqLabel = RECUR_FREQ[freq] || ''
  const isPending = !group.is_paid && !group.postponed && !group.paused
  const countLabel = group.is_installment
    ? `${paidItems.length}/${group.total_installments} pagos`
    : periodCountLabel(paidItems.length, freq) + ' pagadas'

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 8, borderLeft: '5px solid var(--accent)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1, padding: '11px 8px 11px 12px', minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{group.name}</div>
          <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)' }}>{freqLabel}</div>
          {paidItems.length > 0 && <div style={{ fontSize: 11, color: 'var(--paid)', fontWeight: 500, marginTop: 1 }}>{countLabel}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, padding: '11px 8px', flexShrink: 0 }}>
          {totalPaid > 0 && <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{fmt(totalPaid)}</span>}
        </div>
        <div style={{ padding: '8px 6px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {isPending && (
            <button onClick={() => onMarkPaid(group)} style={{ width: 40, height: 40, background: 'var(--paid)', border: 'none', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Check size={18} color="#fff" strokeWidth={2.5} />
            </button>
          )}
          <button onClick={() => setExpanded(v => !v)} style={{ width: 24, height: 24, background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            {expanded ? <ChevronUp size={15} color="var(--text)" /> : <ChevronDown size={15} color="var(--text)" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '0.5px solid var(--border)' }}>
          {allItems.map((p, i) => {
            const overdue  = daysDiff(p.due_date) < 0 && !p.is_paid
            const isPend   = !p.is_paid && !p.postponed
            const isLast   = i === allItems.length - 1
            const instLabel = p.is_installment ? `Pago ${p.current_installment}/${p.total_installments}` : periodLabel(p.due_date, freq)
            const bColor   = p.is_paid ? 'var(--paid)' : p.postponed ? 'var(--muted)' : overdue ? 'var(--danger)' : 'var(--soon-color)'
            const bLabel   = p.is_paid ? 'Pagado' : p.postponed ? 'Pospuesto' : overdue ? 'Vencido' : 'Pendiente'
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '9px 12px 9px 18px', borderBottom: isLast ? 'none' : '0.5px solid var(--bg)', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: overdue ? 'var(--danger)' : p.is_paid ? 'var(--border-mid)' : 'var(--paid)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text)', flex: 1 }}>{instLabel}</span>
                {p.amount > 0 && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{fmt(p.amount)}</span>}
                <span style={{ fontSize: 11, fontWeight: 500, color: bColor }}>{bLabel}</span>
                {isPend && (
                  <button onClick={() => onMarkPaid(p)} style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--paid)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Check size={12} color="#fff" strokeWidth={2.5} />
                  </button>
                )}
                {p.is_paid && (
                  <button onClick={() => onMarkUnpaid(p.id)} style={{ width: 24, height: 24, borderRadius: '50%', background: 'none', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <RotateCcw size={10} color="var(--text)" />
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
