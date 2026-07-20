import { useState, useEffect } from 'react'
import { Lock } from 'lucide-react'
import { fmt } from '../lib/utils'
import styles from './SplitContributionsModal.module.css'

// Registro de "quién puso cuánto" en un gasto del Espacio Compartido —
// deliberadamente NO es un split planeado de antemano (montos fijos por
// acuerdo): es una bitácora que se llena una persona a la vez, cuando cada
// quien se acuerda, y cualquier miembro puede editar la entrada de
// cualquier otro (confirmado con Johnatan). Nunca es obligatorio llenar a
// todos de un jalón — el progreso mostrado es informativo, nunca bloquea.
const PRESET_PERCENTAGES = [25, 50, 60, 75]

export function SplitContributionsModal({ open, payment, spaceMembers, currentUserId, getContributions, registerContribution, onSetTotalAmount, onForceSettle, fundBalance, onSetFundContribution, openedBecauseFundInsufficient, onClose }) {
  const [contributions, setContributions] = useState({}) // { [user_id]: amount }
  const [loading,  setLoading]  = useState(false)
  const [openId,   setOpenId]   = useState(null)
  const [draft,    setDraft]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [settling, setSettling] = useState(false)

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

  async function handlePagar() {
    setSettling(true)
    const { error: err } = await onForceSettle(payment.id)
    setSettling(false)
    if (err) { setError(err.message || 'Error al marcar como pagado'); return }
    onClose()
  }

  const total = Number(payment.amount) || 0
  const needsTotal = payment.is_variable && total <= 0
  const fundAmount = Number(payment.fund_amount) || 0
  const registrado = Object.values(contributions).reduce((s, v) => s + v, 0) + fundAmount
  const restan = total - registrado
  const done = !needsTotal && restan <= 0

  function openRow(memberId) {
    if (openId === memberId) { setOpenId(null); return }
    setOpenId(memberId)
    setDraft(contributions[memberId] != null ? String(contributions[memberId]) : '')
    setError('')
  }

  const FUND_ROW_ID = '__fund__'
  function openFundRow() {
    if (openId === FUND_ROW_ID) { setOpenId(null); return }
    setOpenId(FUND_ROW_ID)
    setDraft(fundAmount > 0 ? String(fundAmount) : '')
    setError('')
  }

  async function handleSaveFund() {
    const val = parseFloat(draft)
    if (draft !== '' && (isNaN(val) || val < 0)) { setError('Ingresa un monto válido'); return }
    const numVal = val || 0
    // Mientras el pago sigue pendiente, no puede exceder ni lo que falta
    // del pago ni lo que el Fondo en verdad tiene ahorrado — el servidor ya
    // valida esto también, esto es solo para no hacer un viaje de más.
    if (!payment.is_paid && numVal > 0) {
      const availableForPayment = total - (registrado - fundAmount)
      const cap = Math.min(availableForPayment, fundBalance + fundAmount)
      if (Math.round(numVal * 100) > Math.round(cap * 100) + 1) {
        setError(`No puedes exceder lo disponible (${fmt(Math.max(0, cap))})`)
        return
      }
    }
    setSaving(true)
    const { error: err } = await onSetFundContribution(payment.id, numVal)
    setSaving(false)
    if (err) { setError(err.message || 'Error al guardar'); return }
    setOpenId(null)
  }

  async function handleSave(memberId) {
    const val = parseFloat(draft)
    if (draft !== '' && (isNaN(val) || val < 0)) { setError('Ingresa un monto válido'); return }
    // Mientras el pago sigue PENDIENTE, nadie puede poner más de lo que en
    // verdad queda disponible — si ya está pagado (se está agregando un
    // contribuyente nuevo a uno ya completo), sí se permite exceder: el
    // servidor resta el sobrante de los demás contribuyentes (ver
    // register-contribution.js, es harina de otro costal).
    if (!payment.is_paid && val > 0) {
      const available = total - (registrado - (contributions[memberId] || 0))
      if (Math.round(val * 100) > Math.round(available * 100) + 1) {
        setError(`No puedes exceder lo disponible (${fmt(Math.max(0, available))})`)
        return
      }
    }
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
              <input type="number" value={totalDraft} onChange={e => setTotalDraft(e.target.value)} placeholder="0.00" onKeyDown={e => e.key === 'Enter' && handleSaveTotal()} className="field-input" style={{ flex: 1 }} />
              <button onClick={handleSaveTotal} disabled={totalSaving} className="btn-primary" style={{ width: 'auto', padding: '0 16px' }}>Guardar</button>
            </div>
          </>
        )}

        {error && <div className={styles.errorBox}>{error}</div>}

        {openedBecauseFundInsufficient && (
          <div className={styles.fundInsufficientNotice}>
            El Fondo Compartido no alcanzaba para cubrir todo el pago — ya se aplicó lo máximo posible ({fmt(fundAmount)}). Completa el resto con la nómina de algún miembro.
          </div>
        )}

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
              {onSetFundContribution && (
                <div className={styles.memberCard}>
                  <div
                    onClick={() => (fundBalance > 0 || fundAmount > 0) && openFundRow()}
                    className={`${styles.memberRow} ${fundBalance <= 0 && fundAmount <= 0 ? styles.memberRowLocked : ''}`}
                  >
                    <span className={styles.memberName}>
                      Fondo Compartido
                      {fundBalance <= 0 && fundAmount <= 0 && <Lock size={12} className={styles.fundLockIcon} />}
                    </span>
                    {fundAmount > 0
                      ? <span className={styles.memberAmount}>{fmt(fundAmount)} <span className={styles.editLabel}>Editar</span></span>
                      : fundBalance > 0
                        ? <span className={styles.memberEmpty}>Sin registrar</span>
                        : <span className={styles.memberEmpty}>Sin saldo</span>}
                  </div>
                  {openId === FUND_ROW_ID && (
                    <div className={styles.editRow}>
                      <input autoFocus type="number" value={draft} onChange={e => setDraft(e.target.value)} placeholder="0.00" onKeyDown={e => e.key === 'Enter' && handleSaveFund()} className="field-input" style={{ flex: 1 }} />
                      <button onClick={handleSaveFund} disabled={saving} className="btn-primary" style={{ width: 'auto', padding: '0 16px' }}>Guardar</button>
                    </div>
                  )}
                </div>
              )}
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
                      <div>
                        {/* Porcentajes SIEMPRE sobre el total fijo, nunca
                            sobre lo que resta — pero se bloquean los que se
                            pasarían de lo que en verdad queda disponible,
                            contando lo que ya pusieron los demás miembros. */}
                        <div className={styles.availableHint}>Disponible: {fmt(Math.max(0, total - (registrado - (amount || 0))))} de {fmt(total)}</div>
                        <div className={styles.presetRow}>
                          {PRESET_PERCENTAGES.map(pct => {
                            const presetAmt = Math.round(total * pct) / 100
                            const available = total - (registrado - (amount || 0))
                            const disabled = Math.round(presetAmt * 100) > Math.round(available * 100) + 1
                            return (
                              <button
                                key={pct}
                                type="button"
                                disabled={disabled}
                                onClick={() => setDraft(String(presetAmt))}
                                className={styles.presetButton}
                              >
                                {pct}%
                              </button>
                            )
                          })}
                        </div>
                        <div className={styles.editRow}>
                          <input autoFocus type="number" value={draft} onChange={e => setDraft(e.target.value)} placeholder="0.00" onKeyDown={e => e.key === 'Enter' && handleSave(m.user_id)} className="field-input" style={{ flex: 1 }} />
                          <button onClick={() => handleSave(m.user_id)} disabled={saving} className="btn-primary" style={{ width: 'auto', padding: '0 16px' }}>Guardar</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {done && !payment.is_paid && (
          <button onClick={handlePagar} disabled={settling} className={styles.payButton}>
            {settling ? 'Marcando…' : 'Pagar'}
          </button>
        )}
        <button onClick={onClose} className="btn-ghost">Cerrar</button>
      </div>
    </div>
  )
}
