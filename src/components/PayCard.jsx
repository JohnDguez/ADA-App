import { useState, useRef, useEffect } from 'react'
import { Check, Pencil, Trash2, Clock, ChevronDown, ChevronUp, RotateCcw, FastForward } from 'lucide-react'
import { statusOf, daysDiff, dateOf, fmt, MONTHS_SHORT, WEEKDAYS_SHORT, nextCobroDate, periodLabel, periodCountLabel, RECUR_FREQ, installmentLabel } from '../lib/utils'

function badgeText(p, cfg) {
  const s = statusOf(p, cfg)
  if (s === 'postponed') return { label: 'Pospuesto', color: 'var(--muted)' }
  if (s === 'paid') return { label: p.is_installment ? installmentLabel(p) + ' ✓' : 'Pagado', color: 'var(--paid)' }
  if (s === 'paused') return { label: 'Pausado', color: 'var(--muted)' }
  const d = daysDiff(p.due_date)
  if (s === 'overdue') return { label: d === -1 ? 'Venció ayer' : `Venció hace ${Math.abs(d)} días`, color: 'var(--danger)' }
  if (s === 'cobro') {
    if (d < 0) return { label: `Venció hace ${Math.abs(d)} días`, color: 'var(--danger)' }
    const nc = nextCobroDate(cfg)
    const t = new Date(); t.setHours(0,0,0,0)
    if (p.is_installment) return { label: installmentLabel(p), color: 'var(--warning)' }
    if (nc.getTime() === t.getTime()) return { label: 'Pagar hoy', color: 'var(--warning)' }
    return { label: `Pagar este ${WEEKDAYS_SHORT[nc.getDay()]}`, color: 'var(--text)', bg: 'var(--text)', textColor: '#fff' }
  }
  if (d === 0) return { label: 'Hoy', color: 'var(--warning)' }
  if (d === 1) return { label: 'Mañana', color: 'var(--warning)' }
  return { label: `Vence en ${d} día${d !== 1 ? 's' : ''}`, color: 'var(--accent)' }
}

function borderColor(p, cfg) {
  const s = statusOf(p, cfg)
  if (s === 'overdue' || (s === 'cobro' && daysDiff(p.due_date) < 0)) return '#B10F17'
  if (s === 'cobro') return '#FAAC2F'
  if (s === 'paid' || s === 'paused' || s === 'postponed') return 'var(--border)'
  return 'var(--accent)' // próximos
}

// Menú contextual por long press
function useLongPress(callback, ms = 500) {
  const timerRef = useRef(null)
  function start(e) {
    e.preventDefault()
    timerRef.current = setTimeout(() => { callback(); timerRef.current = null }, ms)
  }
  function stop() { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null } }
  return { onMouseDown: start, onMouseUp: stop, onMouseLeave: stop, onTouchStart: start, onTouchEnd: stop, onTouchCancel: stop }
}

export function PayCard({ payment: p, cfg, onMarkPaid, onMarkUnpaid, onEdit, onDelete, onPostpone, onAdvance, borderLeft }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const b = badgeText(p, cfg)
  const d = dateOf(p.due_date)
  const isPending = !p.is_paid && !p.postponed && !p.paused
  const leftBorder = borderLeft || borderColor(p, cfg)

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
        style={{
          background: '#FFFFFF',
          borderRadius: 8,
          borderLeft: `5px solid ${leftBorder}`,
          display: 'flex',
          alignItems: 'center',
          overflow: 'visible',
          position: 'relative',
          userSelect: 'none',
        }}
      >
        {/* Info del pago */}
        <div style={{ flex: 1, padding: '12px 8px 12px 14px', minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
            {p.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span>{p.category}</span>
            <span>·</span>
            <span>{d.getDate()} {MONTHS_SHORT[d.getMonth()]}</span>
            {p.is_recurrent && p.recur_freq && !p.is_installment && (
              <><span>·</span><span style={{ color: 'var(--accent)', fontWeight: 500 }}>{RECUR_FREQ[p.recur_freq]}</span></>
            )}
          </div>
        </div>

        {/* Monto + badge */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', padding: '12px 52px 12px 8px', flexShrink: 0 }}>
          {p.is_variable && !p.is_paid
            ? <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: '#8B5CF6', padding: '3px 10px', borderRadius: 20, marginBottom: 4 }}>Pago variable</div>
            : <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{fmt(p.amount)}</div>
          }
          <div style={{ fontSize: 11, fontWeight: 500, color: b.color }}>
            {b.label}
          </div>
        </div>

        {/* Botón $ — mitad dentro mitad afuera */}
        {isPending && (
          <button
            onClick={e => { e.stopPropagation(); onMarkPaid(p) }}
            style={{
              position: 'absolute', right: -18, top: '50%', transform: 'translateY(-50%)',
              width: 40, height: 40, borderRadius: '50%',
              background: 'var(--paid)', border: '3px solid var(--surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 2,
              boxShadow: '0 2px 8px rgba(15,209,67,0.3)',
              fontSize: 16, fontWeight: 700, color: '#fff',
            }}
          >
            $
          </button>
        )}

        {p.is_paid && (
          <div style={{ position: 'absolute', right: -18, top: '50%', transform: 'translateY(-50%)', width: 40, height: 40, borderRadius: '50%', background: 'var(--paid)', border: '3px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', boxShadow: '0 2px 8px rgba(15,209,67,0.3)' }}>
            $
          </div>
        )}
      </div>

      {/* Menú contextual (long press) */}
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
    <div style={{ background: '#FFFFFF', borderRadius: 8, borderLeft: '5px solid var(--accent)', overflow: 'visible' }}>
      <div style={{ display: 'flex', overflow: 'visible' }}>
        <div style={{ flex: 1, padding: '12px 8px 12px 14px', minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{group.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 4 }}>
            <span>{freqLabel}</span>
            {paidItems.length > 0 && <span style={{ color: 'var(--paid)', fontWeight: 500 }}>· {countLabel}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 52px 0 8px', flexShrink: 0 }}>
          {totalPaid > 0 && <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{fmt(totalPaid)}</span>}
          <button onClick={() => setExpanded(v => !v)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'none', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {expanded ? <ChevronUp size={13} color="var(--muted)" /> : <ChevronDown size={13} color="var(--muted)" />}
          </button>
        </div>
        {isPending && (
          <button onClick={() => onMarkPaid(group)} style={{ position: 'absolute', right: -18, top: '50%', transform: 'translateY(-50%)', width: 40, height: 40, borderRadius: '50%', background: 'var(--paid)', border: '3px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2, fontSize: 16, fontWeight: 700, color: '#fff', boxShadow: '0 2px 8px rgba(15,209,67,0.3)' }}>
            $
          </button>
        )}
      </div>

      {expanded && (
        <div style={{ borderTop: '0.5px solid var(--border)' }}>
          {allItems.map((p, i) => {
            const overdue = daysDiff(p.due_date) < 0 && !p.is_paid
            const isPend = !p.is_paid && !p.postponed
            const isLast = i === allItems.length - 1
            const instLabel = p.is_installment ? `Pago ${p.current_installment}/${p.total_installments}` : periodLabel(p.due_date, freq)
            const bText = p.is_paid ? { label: 'Pagado', color: 'var(--paid)' } : p.postponed ? { label: 'Pospuesto', color: 'var(--muted)' } : overdue ? { label: 'Vencido', color: 'var(--danger)' } : { label: 'Pendiente', color: 'var(--warning)' }
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '9px 12px 9px 20px', borderBottom: isLast ? 'none' : '0.5px solid var(--bg)', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: overdue ? 'var(--danger)' : p.is_paid ? 'var(--border-mid)' : 'var(--paid)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>{instLabel}</span>
                {p.amount > 0 && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{fmt(p.amount)}</span>}
                <span style={{ fontSize: 11, fontWeight: 500, color: bText.color }}>{bText.label}</span>
                {isPend && (
                  <button onClick={() => onMarkPaid(p)} style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--paid)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#fff' }}>$</button>
                )}
                {isPend && p.is_recurrent && !p.is_installment && (
                  <button onClick={() => onPostpone(p)} style={{ width: 22, height: 22, borderRadius: '50%', background: 'none', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Clock size={10} color="var(--muted)" />
                  </button>
                )}
                {p.is_paid && (
                  <button onClick={() => onMarkUnpaid(p.id)} style={{ width: 22, height: 22, borderRadius: '50%', background: 'none', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
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
