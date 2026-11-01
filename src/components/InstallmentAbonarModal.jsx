import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { fmt, installmentUntrackedCount } from '../lib/utils'
import { ConfirmCloseModal } from './ConfirmCloseModal'
import AmountInput from './AmountInput'
import styles from './InstallmentAbonarModal.module.css'
import { markBackHandled } from '../lib/backNav'
import { Stack } from '@phosphor-icons/react/dist/csr/Stack'
import { Modal } from './Modal'
import mk from './Modal.module.css'

// Reemplaza el flujo de "Editar" para una copia individual de parcialidad —
// nombre/monto de referencia/total de pagos ahora solo se editan desde el
// master en RecurrentsPage. Aquí solo se abona a ESTE pago puntual, con la
// misma regla de negocio que ya vive en `abonarInstallment` (usePayments.js):
// abonar de menos se queda pendiente en la misma copia sin tocar nada más;
// abonar de más (o justo lo que falta) liquida esta copia y el sobrante
// recorta cuántos pagos faltan hacia adelante, contra el total fijo
// (`master.total_amount`) — nunca se redistribuye entre otras copias.
export function InstallmentAbonarModal({ open, payment, payments, spacePermissions, onConfirm, onClose }) {
  const { t } = useTranslation()
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
    if (!open) return
    const handler = () => {
      markBackHandled()
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
    if (!val || isNaN(val) || val <= 0) { setError(t('installmentAbonarModal.amountError')); return }
    onConfirm(val)
  }

  if (!payment || !master) return null

  const montoRef = Number(master.amount)
  const totalAmount = master.total_amount != null ? Number(master.total_amount) : montoRef * master.total_installments
  // Mismo cálculo que abonarInstallment() (usePayments.js) — incluye los
  // pagos anteriores que nunca se registraron como fila, o la vista previa
  // anunciaría un plan más largo que el real.
  const paidBefore = (payments || [])
    .filter(p => p.parent_id === master.id && p.is_paid)
    .reduce((s, p) => s + Number(p.amount), 0)
    + installmentUntrackedCount(master, payments) * montoRef
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
    previewText = t('installmentAbonarModal.remainingPending', { amount: fmt(resto) })
    pills.push({ n: payment.current_installment, amt: resto, state: 'parcial' })
    for (let i = payment.current_installment + 1; i <= master.total_installments; i++) pills.push({ n: i, amt: montoRef, state: 'futuro' })
  } else if (abonadoNum > 0) {
    const restanteTotal = pendienteAntes - abonadoNum
    if (restanteTotal <= 0) {
      previewText = t('payCard.allPaymentsDone')
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
        previewText = t('installmentAbonarModal.planAdjusts', { oldTotal: master.total_installments, newTotal })
        previewClass = styles.previewAccent
      }
    }
  }

  // Diseño nuevo (v0.9.980): acción rápida con <Modal layout="quick">; el
  // plan de pagos va en chips que se recalculan mientras escribes.
  return (
    <>
      <Modal open={open} onClose={requestClose} layout="quick" icon={Stack} width={480} backClose={false} zIndex={520}
        title={t('installmentAbonarModal.title')}
        desc={`${payment.name} · ${t('installmentAbonarModal.badge', { current: payment.current_installment, total: badgeTotal })}`}
        primary={{ label: t('installmentAbonarModal.confirmButton'), onClick: handleConfirm, disabled: !allowed }}>
        {!allowed && (
          <div className={`${mk.info} ${mk.warnBox}`}>{t('paymentsPage.blockedAction', { action: t('paymentsPage.actionRegisterContributions') })}</div>
        )}
        <div className={`${mk.pan} ${!allowed ? styles.formDisabled : ''}`}>
          <div className={mk.lab}>{t('installmentAbonarModal.amountLabel')}</div>
          <label className={mk.amount}>
            <small>$</small>
            <AmountInput autoFocus value={amount} onChange={e => { setAmount(e.target.value); setError('') }} placeholder="0.00" onKeyDown={e => e.key === 'Enter' && handleConfirm()} />
          </label>
          <div className={mk.chips}>
            <button type="button" className={`${mk.chip} ${parseFloat(amount) === montoRef ? mk.chipOn : ''}`} onClick={() => setAmount(String(montoRef))}>
              {t('installmentAbonarModal.referenceAmount')} {fmt(montoRef)}
            </button>
          </div>
          {error && <div className={mk.err}>{error}</div>}
          <div className={mk.kv}><span>{t('installmentAbonarModal.totalDebt')}</span><b>{fmt(totalPagadoConAbono)} / {fmt(totalAmount)}</b></div>
        </div>
        {previewText && <div key={previewText} className={`${mk.info} ${mk.swap} ${previewClass}`}>{previewText}</div>}
        {pills.length > 0 && (
          <div className={mk.pan}>
            <div className={mk.lab}>{t('installmentAbonarModal.paymentPlan')}</div>
            <div className={styles.plan}>
              {pills.map(p => (
                <div key={p.n} className={`${styles.pill} ${styles['pill_' + p.state]}`}>
                  {p.n}
                  <span className={styles.pillAmount}>{fmt(p.amt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
      <ConfirmCloseModal open={confirmClose} onConfirm={() => { setConfirmClose(false); onClose() }} onCancel={() => setConfirmClose(false)} />
    </>
  )
}
