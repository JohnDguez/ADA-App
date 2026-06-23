import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Check, Pencil, Trash2, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { statusOf, daysDiff, dateOf, fmt, MONTHS, MONTHS_SHORT, WEEKDAYS_SHORT, nextCobroDate, periodLabel, periodCountLabel, RECUR_FREQ } from '../lib/utils'

function badgeOf(p, cfg) {
  const s = statusOf(p, cfg)
  if (s === 'postponed') return { cls: 'b-postponed', label: 'Pospuesto' }
  if (s === 'paid') return { cls: 'b-paid', label: 'Pagado' }
  const d = daysDiff(p.due_date)
  if (s === 'overdue') return { cls: 'b-due', label: 'Vencido' }
  if (s === 'cobro') {
    const nc = nextCobroDate(cfg)
    const t = new Date(); t.setHours(0, 0, 0, 0)
    if (nc.getTime() === t.getTime()) return { cls: 'b-cobro', label: 'Pagar hoy' }
    return { cls: 'b-cobro', label: `Pagar este ${WEEKDAYS_SHORT[nc.getDay()]}` }
  }
  if (d === 0) return { cls: 'b-soon', label: 'Hoy' }
  if (d === 1) return { cls: 'b-soon', label: 'Mañana' }
  if (d <= 5) return { cls: 'b-soon', label: `En ${d} días` }
  return { cls: 'b-ok', label: `En ${d} días` }
}

function barColor(p, cfg) {
  const s = statusOf(p, cfg)
  if (s === 'postponed') return '#C8C5BE'
  if (s === 'paid') return '#C8C5BE'
  if (s === 'overdue' || s === 'cobro') return '#B83232'
  if (s === 'soon') return '#A06B12'
  return '#1E6B45'
}

const BADGE_STYLES = {
  'b-ok': { background: '#EAF4EE', color: '#1E6B45' },
  'b-soon': { background: '#FEF3DC', color: '#A06B12' },
  'b-due': { background: '#FCDEDE', color: '#B83232' },
  'b-paid': { background: '#F0EFE9', color: '#5C5A55' },
  'b-cobro': { background: '#1A1915', color: '#fff' },
  'b-postponed': { background: '#F0EFE9', color: '#5C5A55' },
}

// Tarjeta individual (no agrupada)
export function PayCard({ payment: p, cfg, onMarkPaid, onEdit, onDelete, onPostpone }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const b = badgeOf(p, cfg)
  const bar = barColor(p, cfg)
  const d = dateOf(p.due_date)
  const isPending = !p.is_paid && !p.postponed

  useEffect(() => {
    function handle(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    if (menuOpen) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuOpen])

  return (
    <div style={{ background: '#fff', border: '0.5px solid #E4E2DC', borderRadius: 12, display: 'flex', overflow: 'visible', position: 'relative' }}>
      <div style={{ width: 4, flexShrink: 0, background: bar, borderRadius: '12px 0 0 12px' }} />
      <div style={{ flex: 1, padding: '11px 10px 11px 13px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1915', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>{p.name}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {p.is_variable
              ? <span style={{ fontSize: 11, fontWeight: 500, color: '#A06B12', background: '#FEF3DC', padding: '2px 8px', borderRadius: 20 }}>Variable</span>
              : <span style={{ fontSize: 15, fontWeight: 600, color: '#1A1915' }}>{fmt(p.amount)}</span>
            }
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#5C5A55' }}>
            {p.category} · {d.getDate()} {MONTHS_SHORT[d.getMonth()]}
            {p.is_recurrent && p.recur_freq && <span style={{ marginLeft: 4, color: '#A06B12' }}>· {RECUR_FREQ[p.recur_freq]}</span>}
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, ...BADGE_STYLES[b.cls] }}>{b.label}</span>
        </div>
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px 0 4px', flexShrink: 0 }}>
        {isPending && (
          <button onClick={() => onMarkPaid(p)} style={{ width: 32, height: 32, borderRadius: '50%', background: '#1E6B45', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <Check size={15} color="#fff" strokeWidth={2.5} />
          </button>
        )}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(v => !v)} style={{ width: 30, height: 30, borderRadius: '50%', background: 'none', border: '0.5px solid #E4E2DC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <MoreVertical size={14} color="#5C5A55" />
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', right: 0, top: 34, background: '#fff', border: '0.5px solid #E4E2DC', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50, minWidth: 150, overflow: 'hidden' }}>
              <MenuItem icon={<Pencil size={14} />} label="Editar" onClick={() => { onEdit(p); setMenuOpen(false) }} />
              {isPending && p.is_recurrent && (
                <MenuItem icon={<Clock size={14} />} label="Posponer" onClick={() => { onPostpone(p); setMenuOpen(false) }} />
              )}
              <MenuItem icon={<Trash2 size={14} />} label="Eliminar" onClick={() => { onDelete(p.id); setMenuOpen(false) }} danger />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', fontSize: 13, fontWeight: 500, color: danger ? '#B83232' : '#1A1915', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', textAlign: 'left', borderBottom: '0.5px solid #F0EFE9' }}>
      <span style={{ color: danger ? '#B83232' : '#5C5A55' }}>{icon}</span>
      {label}
    </button>
  )
}

// Tarjeta agrupada (recurrente con hijos)
export function GroupCard({ group, cfg, onMarkPaid, onEdit, onDelete, onPostpone }) {
  const [expanded, setExpanded] = useState(false)
  const allItems = [group, ...group._children]
  const paidItems = allItems.filter(p => p.is_paid)
  const totalPaid = paidItems.reduce((a, p) => a + Number(p.amount), 0)
  const freq = group.recur_freq || 'monthly'
  const countLabel = periodCountLabel(paidItems.length, freq)
  const freqLabel = RECUR_FREQ[freq] || ''
  const isPending = !group.is_paid && !group.postponed

  return (
    <div style={{ background: '#fff', border: '0.5px solid #E4E2DC', borderRadius: 12, overflow: 'visible' }}>
      {/* Cabecera del grupo */}
      <div style={{ display: 'flex', overflow: 'visible' }}>
        <div style={{ width: 4, flexShrink: 0, background: '#1E6B45', borderRadius: expanded ? '12px 0 0 0' : '12px 0 0 12px' }} />
        <div style={{ flex: 1, padding: '11px 10px 11px 13px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1915' }}>{group.name}</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#1A1915' }}>{totalPaid > 0 ? fmt(totalPaid) : '—'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#5C5A55' }}>{freqLabel}</span>
            {paidItems.length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 600, color: '#1E6B45', background: '#EAF4EE', padding: '1px 7px', borderRadius: 20 }}>{countLabel} pagadas</span>
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

      {/* Periodos expandidos */}
      {expanded && (
        <div style={{ borderTop: '0.5px solid #E4E2DC' }}>
          {allItems.map((p, i) => {
            const s = statusOf(p, cfg)
            const b = badgeOf(p, cfg)
            const isLast = i === allItems.length - 1
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '9px 12px 9px 20px', borderBottom: isLast ? 'none' : '0.5px solid #F0EFE9', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: barColor(p, cfg), flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#5C5A55', flex: 1 }}>{periodLabel(p.due_date, freq)}</span>
                {!p.is_variable && p.amount > 0 && (
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1915' }}>{fmt(p.amount)}</span>
                )}
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, ...BADGE_STYLES[b.cls] }}>{b.label}</span>
                {/* Acciones por periodo */}
                {!p.is_paid && !p.postponed && (
                  <button onClick={() => onMarkPaid(p)} style={{ width: 24, height: 24, borderRadius: '50%', background: '#1E6B45', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <Check size={11} color="#fff" strokeWidth={2.5} />
                  </button>
                )}
                {!p.is_paid && !p.postponed && (
                  <button onClick={() => onPostpone(p)} style={{ width: 24, height: 24, borderRadius: '50%', background: 'none', border: '0.5px solid #E4E2DC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <Clock size={11} color="#5C5A55" />
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
