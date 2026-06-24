import { useState } from 'react'
import { Pause, Play, Pencil, CreditCard } from 'lucide-react'
import { fmt, RECUR_FREQ, dateOf, MONTHS_SHORT } from '../lib/utils'

export function RecurrentsPage({ payments, onPause, onResume, onDelete, onEdit }) {
  const [confirmDelete, setConfirmDelete] = useState(null)

  const recurrentMap = {}
  payments.filter(p => p.is_recurrent).forEach(p => {
    if (!recurrentMap[p.name]) {
      recurrentMap[p.name] = { name: p.name, category: p.category, recur_freq: p.recur_freq, is_installment: p.is_installment, total_installments: p.total_installments, is_variable: p.is_variable, items: [], representative: null }
    }
    recurrentMap[p.name].items.push(p)
    if (!recurrentMap[p.name].representative && !p.is_paid) recurrentMap[p.name].representative = p
  })
  Object.values(recurrentMap).forEach(g => {
    if (!g.representative && g.items.length > 0) g.representative = g.items[g.items.length - 1]
  })
  Object.keys(recurrentMap).forEach(name => {
    const hasPending = recurrentMap[name].items.some(p => !p.is_paid)
    if (!hasPending) delete recurrentMap[name]
  })

  const groups = Object.values(recurrentMap).sort((a, b) => a.name.localeCompare(b.name))

  function nextPending(items) {
    return items.filter(p => !p.is_paid && !p.postponed).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))[0]
  }
  function paidCount(items) { return items.filter(p => p.is_paid).length }
  function totalPaid(items) { return items.filter(p => p.is_paid).reduce((a, p) => a + Number(p.amount), 0) }
  function isPaused(items) {
    const pending = items.filter(p => !p.is_paid)
    return pending.length > 0 && pending.every(p => p.paused)
  }

  if (groups.length === 0) {
    return (
      <div style={{ paddingBottom: 100 }}>
        <Header />
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <CreditCard size={36} color="var(--border)" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>Sin pagos recurrentes registrados</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <Header />
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {groups.map(group => {
          const paused = isPaused(group.items)
          const next = nextPending(group.items)
          const paid = paidCount(group.items)
          const total = totalPaid(group.items)
          const freqLabel = RECUR_FREQ[group.recur_freq] || '—'
          const isDeleting = confirmDelete === group.name

          return (
            <div key={group.name} style={{ background: 'var(--surface)', border: `0.5px solid ${paused ? 'var(--warning-border)' : 'var(--border)'}`, borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <div style={{ padding: '13px 14px', borderBottom: isDeleting ? '0.5px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>{group.name}</span>
                      {paused && <span className="badge badge-soon">Pausado</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {group.category} · {freqLabel}
                      {group.is_installment && ` · ${paid}/${group.total_installments} pagos`}
                      {group.is_variable && ' · Variable'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                    {group.representative && (
                      <button onClick={() => onEdit(group.representative)} style={{ width: 32, height: 32, borderRadius: '50%', border: '0.5px solid var(--border)', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <Pencil size={14} color="var(--muted)" />
                      </button>
                    )}
                    <button onClick={() => paused ? onResume(group.name) : onPause(group.name)} style={{ width: 32, height: 32, borderRadius: '50%', border: '0.5px solid var(--border)', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      {paused ? <Play size={14} color="var(--paid)" /> : <Pause size={14} color="var(--warning)" />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {total > 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Pagado: <strong style={{ color: 'var(--text)' }}>{fmt(total)}</strong></div>}
                    {next && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Próximo: <strong style={{ color: 'var(--text)' }}>{dateOf(next.due_date).getDate()} {MONTHS_SHORT[dateOf(next.due_date).getMonth()]}{!group.is_variable && next.amount > 0 ? ` · ${fmt(next.amount)}` : ''}</strong></div>}
                  </div>
                  <button onClick={() => setConfirmDelete(isDeleting ? null : group.name)} style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: 0 }}>
                    Eliminar
                  </button>
                </div>
              </div>

              {isDeleting && (
                <div style={{ padding: '12px 14px', background: 'var(--danger-soft)', borderTop: '0.5px solid var(--danger-border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>¿Eliminar "{group.name}"?</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Los pagos realizados quedan en el historial. Los pendientes se eliminan y podrás reusar este nombre.</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { onDelete(group.name); setConfirmDelete(null) }} style={{ flex: 1, padding: '9px 0', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>Eliminar</button>
                    <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '9px 0', background: 'none', color: 'var(--muted)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Header() {
  return (
    <div style={{ padding: '20px 16px 8px' }}>
      <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>Fijos</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Gestiona tus pagos recurrentes y parcialidades</div>
    </div>
  )
}
