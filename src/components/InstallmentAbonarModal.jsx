import { useState, useEffect, useRef, useMemo } from 'react'
import { fmt } from '../lib/utils'
import { ConfirmCloseModal } from './ConfirmCloseModal'
import styles from './InstallmentAbonarModal.module.css'

// Reemplaza el flujo de "Editar" para una copia individual de parcialidad —
// nombre/monto de referencia/total de pagos ahora solo se editan desde el
// master en RecurrentsPage. Aquí solo se abona a ESTE pago puntual, con la
// misma regla de negocio que ya vive en `abonarInstallment` (usePayments.js):
// abonar de menos se queda pendiente en la misma copia sin tocar nada más;
// abonar de más (o justo lo que falta) liquida esta copia y el sobrante
// recorta cuántos pagos faltan hacia adelante, contra el total fijo
// (`master.total_amount`) — nunca se redistribuye entre otras copias.
export function InstallmentAbonarModal({ open, payment, payments, spacePermissions, onConfirm, onClose }) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const amountRef = useRef(amount)

  const allowed = !spacePermissions || spacePermissions.can_mark_paid

  const master = useMemo(() => {
    if (!payment) return null
    return (payments || []).find(p => p.id === payment.parent_id) || null
  }, [payment, payments])

  useEffect(() => { amountRef.current = amount }, [amount])
  useEffect(() => {
    if (!open) { setAmount(''); setError(''); return }
    if (payment?.amount) setAmount(String(payment.amount))
  }, [open, payment])

  useEffect(() => {
    if (open) document.body.classList.add('modal-open')
    else document.body.classList.remove('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = () => {
      if (amountRef.current) setConfirmClose(true)
      else onClose()
    }
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [open])

  function requestClose() { if (amount) { setConfirmClose(true); return }; onClose() }

  function handleConfirm() {
    const val = parseFloat(amount)
    if (!val || isNaN(val) || val <= 0) { setError('Ingresa cuánto vas a abonar'); return }
    onConfirm(val)
  }

  if (!open || !payment || !master) return null

  const montoRef = Number(master.amount)
  const totalAmount = master.total_amount != null ? Number(master.total_amount) : montoRef * master.total_installments
  const paidBefore = (payments || [])
    .filter(p => p.parent_id === master.id && p.is_paid)
    .reduce((s, p) => s + Number(p.amount), 0)
  const pendienteAntes = totalAmount - paidBefore

  const abonadoNum = parseFloat(amount) || 0
  const totalPagadoConAbono = Math.min(paidBefore + abonadoNum, totalAmount)
  const pills = []
  for (let i = 1; i < payment.current_installment; i++) pills.push({ n: i, amt: montoRef, state: 'pagado' })

  let previewText = ''
  let previewClass = styles.previewNeutral
  let badgeTotal = master.total_installments

  if (abonadoNum > 0 && abonadoNum < Number(payment.amount)) {
    const resto = Number(payment.amount) - abonadoNum
    previewText = `Quedarán ${fmt(resto)} pendientes en este pago.`
    pills.push({ n: payment.current_installment, amt: resto, state: 'parcial' })
    for (let i = payment.current_installment + 1; i <= master.total_installments; i++) pills.push({ n: i, amt: montoRef, state: 'futuro' })
  } else if (abonadoNum > 0) {
    const restanteTotal = pendienteAntes - abonadoNum
    if (restanteTotal <= 0) {
      previewText = '¡Terminaste todos los pagos!'
      previewClass = styles.previewSuccess
      pills.push({ n: payment.current_installment, amt: abonadoNum, state: 'ultimo' })
      badgeTotal = payment.current_installment
    } else {
      const faltan = Math.ceil(restanteTotal / montoRef)
      const newTotal = payment.current_installment + faltan
      pills.push({ n: payment.current_installment, amt: Number(payment.amount), state: 'pagado' })
      for (let i = payment.current_installment + 1; i < newTotal; i++) pills.push({ n: i, amt: montoRef, state: 'futuro' })
      const restoUltimo = restanteTotal - (faltan - 1) * montoRef
      pills.push({ n: newTotal, amt: restoUltimo, state: 'futuro-ultimo' })
      badgeTotal = newTotal
      if (newTotal < master.total_installments) {
        previewText = `El plan se ajusta de ${master.total_installments} a ${newTotal} pagos en total.`
        previewClass = styles.previewAccent
      }
    }
  }

  return (
    <>
      <div onClick={e => e.target === e.currentTarget && requestClose()} className={styles.overlay}>
        <div className={styles.modal}>
          <div className={styles.handle} />
          <div className={styles.headerRow}>
            <span className={styles.title}>Abonar</span>
            <span className={styles.badge}>Pago {payment.current_installment} de {badgeTotal}</span>
          </div>
          <div className={styles.description}>{payment.name}</div>

          <div className={styles.refRow}>
            <span>Monto de referencia</span>
            <span className={styles.refAmount}>{fmt(montoRef)}</span>
          </div>
          <div className={`${styles.refRow} ${styles.refRowNoTop}`}>
            <span>Total de la deuda</span>
            <span className={styles.refAmount}>{fmt(totalPagadoConAbono)} / {fmt(totalAmount)}</span>
          </div>

          {!allowed && (
            <div className={styles.warningBox}>
              No tienes permitido registrar abonos en este Espacio Compartido.
            </div>
          )}
          {error && <div className={styles.errorBox}>{error}</div>}

          <div className={`${styles.formWrapper} ${!allowed ? styles.formDisabled : ''}`}>
            <label className="field-label">Cuánto vas a abonar</label>
            <input autoFocus type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" onKeyDown={e => e.key === 'Enter' && handleConfirm()} className={`field-input ${styles.input}`} />

            {previewText && <div className={`${styles.preview} ${previewClass}`}>{previewText}</div>}

            {pills.length > 0 && (
              <>
                <label className="field-label">Plan de pagos</label>
                <div className={styles.plan}>
                  {pills.map(p => (
                    <div key={p.n} className={`${styles.pill} ${styles['pill_' + p.state]}`}>
                      {p.n}
                      <span className={styles.pillAmount}>{fmt(p.amt)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <button onClick={handleConfirm} disabled={!allowed} className={`btn-primary ${styles.confirmButton}`}>Confirmar abono</button>
          </div>
          <button onClick={requestClose} className="btn-ghost">Cancelar</button>
        </div>
      </div>
      <ConfirmCloseModal open={confirmClose} onConfirm={() => { setConfirmClose(false); onClose() }} onCancel={() => setConfirmClose(false)} />
    </>
  )
}
