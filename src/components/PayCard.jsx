import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Check, Pencil, Trash2, Clock, ChevronDown, ChevronUp, RotateCcw, FastForward } from 'lucide-react'
import { statusOf, daysDiff, dateOf, fmt, MONTHS_SHORT, WEEKDAYS_SHORT, nextCobroDate, periodLabel, periodCountLabel, RECUR_FREQ, installmentLabel } from '../lib/utils'

function badgeOf(p, cfg) {
  const s = statusOf(p, cfg)
  if (s === 'postponed') return { cls: 'postponed', label: 'Pospuesto' }
  if (s === 'paid') return { cls: 'paid', label: p.is_installment ? installmentLabel(p) + ' ✓' : 'Pagado' }
  const d = daysDiff(p.due_date)
  if (s === 'overdue') return { cls: 'due', label: 'Vencido' }
  if (s === 'cobro') {
    const nc = nextCobroDate(cfg)
    const t = new Date(); t.setHours(0,0,0,0)
    const label = p.is_installment ? installmentLabel(p) : (nc.getTime() === t.getTime() ? 'Pagar hoy' : `Pagar este ${WEEKDAYS_SHORT[nc.getDay()]}`)
    return { cls: 'cobro', label }
  }
  const base = p.is_installment ? installmentLabel(p) : (d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : `En ${d} días`)
  const cls = d === 0 || d === 1 ? 'soon' : d <= 5 ? 'soon' : 'ok'
  return { cls, label: base }
}

const BADGE = {
  ok: { background: '#EAF4EE', color: '#1E6B45' },
  soon: { background: '#FEF3DC', color: '#A06B12' },
  due: { background: '#FCDEDE', color: '#B83232' },
  paid: { background: '#F0EFE9', color: '#5C5A55' },
  cobro: { background: '#1A1915', color: '#fff' },
  postponed: { background: '#F0EFE9', color: '#5C5A55' },
}

function barColor(p, cfg) {
  const s = statusOf(p, cfg)
  if (s === 'postponed' || s === 'paid') return '#C8C5BE'
  if (s === 'overdue' || s === 'cobro') return '#B83232'
  if (s === 'soon') return '#A06B12'
  return '#1E6B45'
}

export function PayCard({ payment: p, cfg, onMarkPaid, onMarkUnpaid, onEdit, onDelete, onPostpone, onAdvance }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const b = badgeOf(p, cfg)
  const bar = barColor(p, cfg)
  const d = dateOf(p.due_date)
  const isPending = !p.is_paid && !p.postponed

  // Último pago de parcialidad
  const isLastInstallment = p.is_installment && p.current_installment === p.total_installments

  useEffect(() => {
    function handle(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    if (menuOpen) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuOpen])

  return (
    <div style={{ background: '#fff', border: '0.5px solid #E4E2DC', borderRadius: 12, display: 'flex', overflow: 'visible', position: 'relative' }}>
      <div style={{ width: 4, flexShrink: 0, background: bar, borderRadius: '12px 0 0 12px' }} />
      <div style={{ flex: 1, padding: '11px 8px 11px 13px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1915', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 155 }}>{p.name}</span>
          {p.is_variable && !p.is_paid
            ? <span style={{ fontSize: 11, fontWeight: 500, color: '#A06B12', background: '#FEF3DC', padding: '2px 8px', borderRadius: 20 }}>Variable</span>
            : <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1915' }}>{fmt(p.amount)}</span>
          }
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#5C5A55' }}>
            {p.category} · {d.getDate()} {MONTHS_SHORT[d.getMonth()]}
            {p.is_recurrent && p.recur_freq && !p.is_installment && <span style={{ color: '#A06B12' }}> · {RECUR_FREQ[p.recur_freq]}</span>}
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, ...BADGE[b.cls] }}>{b.label}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px 0 4px', flexShrink: 0 }}>
        {isPending && (
          <button onClick={() => onMarkPaid(p)} style={{ width: 32, height: 32, borderRadius: '50%', background: '#1E6B45', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Check size={15} color="#fff" strokeWidth={2.5} />
          </button>
        )}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(v => !v)} style={{ width: 30, height: 30, borderRadius: '50%', background: 'none', border: '0.5px solid #E4E2DC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <MoreVertical size={14} color="#5C5A55" />
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', right: 0, top: 34, background: '#fff', border: '0.5px solid #E4E2DC', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50, minWidth: 160, overflow: 'hidden' }}>
              {!p.is_paid && !p.postponed && <MenuItem icon={<Pencil size={14}/>} label="Editar" onClick={() => { onEdit(p); setMenuOpen(false) }} />}
              {isPending && p.is_recurrent && !p.is_installment && <MenuItem icon={<Clock size={14}/>} label="Posponer" onClick={() => { onPostpone(p); setMenuOpen(false) }} />}
              {isPending && p.is_installment && !isLastInstallment && onAdvance && <MenuItem icon={<FastForward size={14}/>} label="Adelantar pago" onClick={() => { onAdvance(p); setMenuOpen(false) }} />}
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
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', borderBottom: '0.5px solid #F0EFE9', fontSize: 13, fontWeight: 500, color: danger ? '#B83232' : '#1A1915', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', textAlign: 'left' }}>
      <span style={{ color: danger ? '#B83232' : '#5C5A55' }}>{icon}</span>{label}
    </button>
  )
}

// Tarjeta agrupada — solo en la vista Pagos
export function GroupCard({ group, cfg, onMarkPaid, onMarkUnpaid, onEdit, onDelete, onPostpone, onAdvance }) {
  const [expanded, setExpanded] = useState(false)
  const allItems = [group, ...group._children]
  const paidItems = allItems.filter(p => p.is_paid)
  const totalPaid = paidItems.reduce((a, p) => a + Number(p.amount), 0)
  const freq = group.recur_freq || 'monthly'
  const freqLabel = RECUR_FREQ[freq] || ''
  const isPending = !group.is_paid && !group.postponed
  const isInstallment = group.is_installment
  const totalInstallments = group.total_installments
  const countLabel = isInstallment
    ? `${paidItems.length}/${totalInstallments} pagos`
    : periodCountLabel(paidItems.length, freq) + ' pagadas'

  return (
    <div style={{ background: '#fff', border: '0.5px solid #E4E2DC', borderRadius: 12, overflow: 'visible' }}>
      <div style={{ display: 'flex', overflow: 'visible' }}>
        <div style={{ width: 4, flexShrink: 0, background: '#1E6B45', borderRadius: expanded ? '12px 0 0 0' : '12px 0 0 12px' }} />
        <div style={{ flex: 1, padding: '11px 8px 11px 13px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1915' }}>{group.name}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1915' }}>{totalPaid > 0 ? fmt(totalPaid) : '—'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#5C5A55' }}>{freqLabel}</span>
            {paidItems.length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 600, color: '#1E6B45', background: '#EAF4EE', padding: '1px 7px', borderRadius: 20 }}>{countLabel}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px 0 4px', flexShrink: 0 }}>
          {isPending && (
            <button onClick={() => onMarkPaid(group)} style={{ width: 32, height: 32, borderRadius: '50%', background: '#1E6B45', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Check size={15} color="#fff" strokeWidth={2.5} />
            </button>
          )}
          <button onClick={() => setExpanded(v => !v)} style={{ width: 30, height: 30, borderRadius: '50%', background: 'none', border: '0.5px solid #E4E2DC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {expanded ? <ChevronUp size={14} color="#5C5A55" /> : <ChevronDown size={14} color="#5C5A55" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '0.5px solid #E4E2DC' }}>
          {allItems.map((p, i) => {
            const s = statusOf(p, cfg)
            const isPend = !p.is_paid && !p.postponed
            const isLast = i === allItems.length - 1
            const instLabel = p.is_installment ? `Pago ${p.current_installment}/${p.total_installments}` : periodLabel(p.due_date, freq)
            const badgeStyle = s === 'paid' ? BADGE.paid : s === 'postponed' ? BADGE.postponed : s === 'overdue' ? BADGE.due : BADGE.soon
            const badgeText = s === 'paid' ? 'Pagado' : s === 'postponed' ? 'Pospuesto' : s === 'overdue' ? 'Vencido' : 'Pendiente'
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '9px 12px 9px 20px', borderBottom: isLast ? 'none' : '0.5px solid #F0EFE9', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: barColor(p, cfg), flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#5C5A55', flex: 1 }}>{instLabel}</span>
                {p.amount > 0 && <span style={{ fontSize: 12, fontWeight: 500, color: '#1A1915' }}>{fmt(p.amount)}</span>}
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, ...badgeStyle }}>{badgeText}</span>
                {isPend && (
                  <button onClick={() => onMarkPaid(p)} style={{ width: 22, height: 22, borderRadius: '50%', background: '#1E6B45', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <Check size={10} color="#fff" strokeWidth={2.5} />
                  </button>
                )}
                {isPend && p.is_recurrent && !p.is_installment && (
                  <button onClick={() => onPostpone(p)} style={{ width: 22, height: 22, borderRadius: '50%', background: 'none', border: '0.5px solid #E4E2DC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <Clock size={10} color="#5C5A55" />
                  </button>
                )}
                {p.is_paid && (
                  <button onClick={() => onMarkUnpaid(p.id)} style={{ width: 22, height: 22, borderRadius: '50%', background: 'none', border: '0.5px solid #E4E2DC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <RotateCcw size={10} color="#5C5A55" />
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
