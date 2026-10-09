import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmCloseModal } from './ConfirmCloseModal'
import AmountInput from './AmountInput'
import styles from './VariableAmountModal.module.css'
import { markBackHandled } from '../lib/backNav'
import { ModalSheet, SheetButton } from './ModalSheet'
import { Coins } from '@phosphor-icons/react/dist/csr/Coins'

export function VariableAmountModal({ open, payment, mode = 'pay', spacePermissions, onConfirm, onClose }) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const amountRef = useRef(amount)

  // "Registrar pago" (mode='pay', se usa al marcar pagado) cae bajo el
  // mismo permiso que marcar pagado — "Monto a pagar" (mode='estimate',
  // capturar el monto SIN marcar pagado) cae bajo editar, tal como se
  // decidió y ya se aplicó en el trigger de la base de datos (v0.9.132).
  const allowed = !spacePermissions || (mode === 'estimate' ? spacePermissions.can_edit : spacePermissions.can_mark_paid)

  useEffect(() => { amountRef.current = amount }, [amount])
  useEffect(() => {
    if (!open) { setAmount(''); setError('') }
    // Si el pago ya trae un monto capturado previamente (estimado, o un
    // intento anterior), se precarga en vez de arrancar vacío — así el
    // usuario no tiene que volver a escribirlo si solo va a confirmarlo.
    else if (payment?.amount) setAmount(String(payment.amount))
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
    if (!val || isNaN(val) || val <= 0) { setError(mode === 'estimate' ? t('variableAmountModal.errorEstimate') : t('variableAmountModal.errorPay')); return }
    onConfirm(val)
  }

  if (!payment) return null

  return (
    <>
      <ModalSheet open={open} icon={Coins} title={mode === 'estimate' ? t('variableAmountModal.titleEstimate') : t('variableAmountModal.titlePay')} onBackdrop={requestClose} zIndex={250}>
        <div>
          <ModalSheet.Text>
            {payment.name} — {mode === 'estimate' ? t('variableAmountModal.descriptionEstimate') : t('variableAmountModal.descriptionPay')}
          </ModalSheet.Text>
          {!allowed && (
            <div className={styles.warningBox}>
              {t('paymentsPage.blockedAction', { action: mode === 'estimate' ? t('paymentsPage.actionEditPayments') : t('paymentsPage.actionMarkPayments') })}
            </div>
          )}
          {error && <div className={styles.errorBox}>{error}</div>}
          <div className={`${styles.formWrapper} ${!allowed ? styles.formDisabled : ''}`}>
            <label className="field-label">{mode === 'estimate' ? t('variableAmountModal.amountLabelEstimate') : t('variableAmountModal.amountLabelPay')}</label>
            <AmountInput autoFocus value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" onKeyDown={e => e.key === 'Enter' && handleConfirm()} className={`field-input ${styles.input}`} />
            <SheetButton onClick={handleConfirm} disabled={!allowed}>{mode === 'estimate' ? t('variableAmountModal.saveEstimate') : t('variableAmountModal.savePay')}</SheetButton>
          </div>
          <SheetButton variant="soft" onClick={requestClose}>{t('buttons.cancel')}</SheetButton>
        </div>
      </ModalSheet>
      <ConfirmCloseModal open={confirmClose} onConfirm={() => { setConfirmClose(false); onClose() }} onCancel={() => setConfirmClose(false)} />
    </>
  )
}
