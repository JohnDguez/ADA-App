import { useState } from 'react'
import { Pause, Play, Trash2, RefreshCw, CreditCard } from 'lucide-react'
import { fmt, RECUR_FREQ, dateOf, MONTHS_SHORT } from '../lib/utils'

export function RecurrentsPage({ payments, onPause, onResume, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Agrupa recurrentes por nombre (un entry por nombre único)
  const recurrentMap = {}
  payments.filter(p => p.is_recurrent).forEach(p => {
    if (!recurrentMap[p.name]) {
      recurrentMap[p.name] = {
        name: p.name,
        category: p.category,
        recur_freq: p.recur_freq,
        is_installment: p.is_installment,
        total_installments: p.total_installments,
        is_variable: p.is_variable,
        paused: p.paused,
        items: []
      }
    }
    recurrentMap[p.name].items.push(p)
    // Si alguno no está pausado, el grupo no está pausado
    if (!p.paused && !p.is_paid) recurrentMap[p.name].paused = false
  })

  const groups = Object.values(recurrentMap).sort((a, b) => a.name.localeCompare(b.name))

  function nextPending(items) {
    return items.filter(p => !p.is_paid && !p.postponed).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))[0]
  }

  function paidCount(items) {
    return items.filter(p => p.is_paid).length
  }

  function totalPaid(items) {
    return items.filter(p => p.is_paid).reduce((a, p) => a + Number(p.amount), 0)
  }

  function isPaused(items) {
    const pending = items.filter(p => !p.is_paid)
    return pending.length > 0 && pending.every(p => p.paused)
  }

  if (groups.length === 0) {
    return (
      <div style={{ paddingBottom: 80 }}>
        <div style={{ padding: '20px 16px 8px' }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#1A1915' }}>Recurrentes</div>
          <div style={{ fontSize: 13, color: '#5C5A55', marginTop: 2 }}>Gestiona tus pagos recurrentes y parcialidades</div>
        </div>
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <CreditCard size={36} color="#C8C5BE" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, color: '#5C5A55' }}>Sin pagos recurrentes registrados</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ padding: '20px 16px 8px' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#1A1915' }}>Recurrentes</div>
        <div style={{ fontSize: 13, color: '#5C5A55', marginTop: 2 }}>Gestiona tus pagos recurrentes y parcialidades</div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {groups.map(group => {
          const paused = isPaused(group.items)
          const next = nextPending(group.items)
          const paid = paidCount(group.items)
          const total = totalPaid(group.items)
          const freqLabel = RECUR_FREQ[group.recur_freq] || group.recur_freq || '—'
          const isDeleting = confirmDelete === group.name

          return (
            <div key={group.name} style={{ background: '#fff', border: `0.5px solid ${paused ? '#F5D9A0' : '#E4E2DC'}`, borderRadius: 12, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '13px 14px', borderBottom: isDeleting ? '0.5px solid #E4E2DC' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1915', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{group.name}</span>
                      {paused && <span style={{ fontSize: 10, fontWeight: 600, color: '#A06B12', background: '#FEF3DC', padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>Pausado</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#5C5A55' }}>
                      {group.category} · {freqLabel}
                      {group.is_installment && ` · ${paid}/${group.total_installments} pagos`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                    <button
                      onClick={() => paused ? onResume(group.name) : onPause(group.name)}
                      title={paused ? 'Reactivar' : 'Pausar'}
                      style={{ width: 32, height: 32, borderRadius: '50%', border: '0.5px solid #E4E2DC', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      {paused ? <Play size={14} color="#1E6B45" /> : <Pause size={14} color="#A06B12" />}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(isDeleting ? null : group.name)}
                      title="Eliminar recurrencia"
                      style={{ width: 32, height: 32, borderRadius: '50%', border: '0.5px solid #FCDEDE', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Trash2 size={14} color="#B83232" />
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  {total > 0 && (
                    <div style={{ fontSize: 12, color: '#5C5A55' }}>
                      Pagado: <strong style={{ color: '#1A1915' }}>{fmt(total)}</strong>
                    </div>
                  )}
                  {next && (
                    <div style={{ fontSize: 12, color: '#5C5A55' }}>
                      Próximo: <strong style={{ color: '#1A1915' }}>
                        {dateOf(next.due_date).getDate()} {MONTHS_SHORT[dateOf(next.due_date).getMonth()]}
                        {!group.is_variable && next.amount > 0 && ` · ${fmt(next.amount)}`}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Confirmación eliminar */}
              {isDeleting && (
                <div style={{ padding: '12px 14px', background: '#FFF8F8', borderTop: '0.5px solid #FCDEDE' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1915', marginBottom: 4 }}>¿Eliminar pagos futuros?</div>
                  <div style={{ fontSize: 12, color: '#5C5A55', marginBottom: 10 }}>
                    Los pagos ya realizados se conservarán en el historial. Solo se eliminarán los periodos pendientes.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { onDelete(group.name); setConfirmDelete(null) }} style={{ flex: 1, padding: '9px 0', background: '#B83232', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                      Eliminar futuros
                    </button>
                    <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '9px 0', background: 'none', color: '#5C5A55', border: '0.5px solid #E4E2DC', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                      Cancelar
                    </button>
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
