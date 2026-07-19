import { useState, useEffect } from 'react'
import { fmt } from '../lib/utils'
import styles from './SplitContributionsModal.module.css'

// Registro de "quién puso cuánto" en un gasto del Espacio Compartido —
// deliberadamente NO es un split planeado de antemano (montos fijos por
// acuerdo): es una bitácora que se llena una persona a la vez, cuando cada
// quien se acuerda, y cualquier miembro puede editar la entrada de
// cualquier otro (confirmado con Johnatan). Nunca es obligatorio llenar a
// todos de un jalón — el progreso mostrado es informativo, nunca bloquea.
export function SplitContributionsModal({ open, payment, spaceMembers, currentUserId, getContributions, registerContribution, onSetTotalAmount, onClose }) {
  const [contributions, setContributions] = useState({}) // { [user_id]: amount }
  const [loading,  setLoading]  = useState(false)
  const [openId,   setOpenId]   = useState(null)
  const [draft,    setDraft]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  // Solo para pagos variables — el monto no se sabe de antemano, así que se
  // captura/edita aquí mismo (antes vivía solo en "Agregar monto", un
  // camino totalmente aparte que nunca revisaba si los abonos ya cubrían el
  // total; ahora todo pasa por el mismo lugar).
  const [totalDraft,  setTotalDraft]  = useState('')
  const [totalSaving, setTotalSaving] = useState(false)

  useEffect(() => {
    if (!open || !payment) return
    setOpenId(null); setDraft(''); setError('')
    setTotalDraft(payment.amount ? String(payment.amount) : '')
    setLoading(true)
    getContributions(payment.id).then(({ contributions: rows }) => {
      const map = {}
      for (const r of rows) map[r.user_id] = Number(r.amount)
      setContributions(map)
      setLoading(false)
    })
  }, [open, payment?.id])

  useEffect(() => {
    if (open) document.body.classList.add('modal-open')
    else document.body.classList.remove('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [open])

  if (!open || !payment) return null

  async function handleSaveTotal() {
    const val = parseFloat(totalDraft)
    if (isNaN(val) || val <= 0) { setError('Ingresa un monto válido'); return }
    setTotalSaving(true)
    const { error: err } = await onSetTotalAmount(payment.id, val)
    setTotalSaving(false)
    if (err) { setError(err.message || 'Error al guardar el monto'); return }
    setError('')
  }

  const total = Number(payment.amount) || 0
  const needsTotal = payment.is_variable && total <= 0
  const registrado = Object.values(contributions).reduce((s, v) => s + v, 0)
  const restan = total - registrado
  const done = !needsTotal && restan <= 0

  function openRow(memberId) {
    if (openId === memberId) { setOpenId(null); return }
    setOpenId(memberId)
    setDraft(contributions[memberId] != null ? String(contributions[memberId]) : '')
    setError('')
  }

  async function handleSave(memberId) {
    const val = parseFloat(draft)
    if (draft !== '' && (isNaN(val) || val < 0)) { setError('Ingresa un monto válido'); return }
    setSaving(true)
    const { error: err } = await registerContribution(payment.id, memberId, val || 0)
    setSaving(false)
    if (err) { setError(err.message || 'Error al guardar'); return }
    setContributions(prev => {
      const next = { ...prev }
      if (!val || val <= 0) delete next[memberId]
      else next[memberId] = val
      return next
    })
    setOpenId(null)
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.handle} />
        <div className={styles.title}>Dividir entre miembros</div>
        <div className={styles.description}>{payment.name}</div>

        {payment.is_variable && (
          <>
            <label className="field-label">Monto total a pagar</label>
            <div className={styles.editRow}>
              <input type="number" value={totalDraft} onChange={e => setTotalDraft(e.target.value)} placeholder="0.00" onKeyDown={e => e.key === 'Enter' && handleSaveTotal()} className={`field-input ${styles.editInput}`} />
              <button onClick={handleSaveTotal} disabled={totalSaving} className={`btn-primary ${styles.saveButton}`}>Guardar</button>
            </div>
          </>
        )}

        {error && <div className={styles.errorBox}>{error}</div>}

        {!loading && !needsTotal && (
          <div className={`${styles.progress} ${done ? styles.progressDone : ''}`}>
            <div className={styles.progressAmounts}>{fmt(registrado)} / {fmt(total)}</div>
            <div className={styles.progressStatus}>{done ? 'Completo' : `Restan: ${fmt(restan)}`}</div>
          </div>
        )}

        {!needsTotal && (
          <>
            <label className="field-label">Miembros</label>
            <div className={styles.members}>
              {spaceMembers.map(m => {
                const isOpen = openId === m.user_id
                const amount = contributions[m.user_id]
                return (
                  <div key={m.user_id} className={styles.memberCard}>
                    <div onClick={() => openRow(m.user_id)} className={styles.memberRow}>
                      <span className={styles.memberName}>{m.profile?.name || 'Miembro'}{m.user_id === currentUserId ? ' (tú)' : ''}</span>
                      {amount != null
                        ? <span className={styles.memberAmount}>{fmt(amount)} <span className={styles.editLabel}>Editar</span></span>
                        : <span className={styles.memberEmpty}>Sin registrar</span>}
                    </div>
                    {isOpen && (
                      <div className={styles.editRow}>
                        <input autoFocus type="number" value={draft} onChange={e => setDraft(e.target.value)} placeholder="0.00" onKeyDown={e => e.key === 'Enter' && handleSave(m.user_id)} className={`field-input ${styles.editInput}`} />
                        <button onClick={() => handleSave(m.user_id)} disabled={saving} className={`btn-primary ${styles.saveButton}`}>Guardar</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        <button onClick={onClose} className="btn-ghost">Cerrar</button>
      </div>
    </div>
  )
}
