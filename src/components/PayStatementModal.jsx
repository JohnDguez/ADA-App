import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import AmountInput from './AmountInput'
import { PaymentMethodField } from './PaymentMethodField'
import { fmt } from '../lib/utils'
import styles from './PayCardNowModal.module.css'
import { useScrollLock } from '../lib/scrollLock'

// Pagar el estado de cuenta de una tarjeta desde Inicio (v0.9.740, mockup
// aprobado por Johnatan). Antes reutilizaba el modal de "monto variable":
// pedía el monto aunque se fuera a pagar completo y nunca preguntaba con qué
// se pagó. Ahora: monto fijo (lo debido) + "¿Con qué pagaste?" (solo Efectivo
// o Débito: pagar una tarjeta con otra no tiene sentido en este modelo), y el
// campo de monto solo aparece al tocar "Abonar otro monto". Misma animación
// que PayCardNowModal (ANIM_MS = 320, Regla 30). Resuelve con
// { amount, methodId }; la diferencia contra lo debido la convierte en acarreo
// App.jsx → confirmVariablePaid.
const ANIM_MS = 320

export function PayStatementModal({ open, payment, title, methods, onConfirm, onClose }) {
  useScrollLock(open)
  const { t } = useTranslation()
  const [partial, setPartial] = useState(false)
  const [amount, setAmount] = useState('')
  const [methodId, setMethodId] = useState(null)
  const [error, setError] = useState('')

  const [closing, setClosing] = useState(false)
  const [entering, setEntering] = useState(false)
  const wasOpenRef = useRef(open)
  const closeTimerRef = useRef(null)
  const enterTimerRef = useRef(null)

  useEffect(() => () => { clearTimeout(closeTimerRef.current); clearTimeout(enterTimerRef.current) }, [])
  useEffect(() => {
    if (!wasOpenRef.current && open) {
      setEntering(true)
      clearTimeout(enterTimerRef.current)
      enterTimerRef.current = setTimeout(() => setEntering(false), ANIM_MS)
    }
    if (wasOpenRef.current && !open) {
      setClosing(true)
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = setTimeout(() => setClosing(false), ANIM_MS)
    }
    wasOpenRef.current = open
  }, [open])

  useEffect(() => {
    if (open) { setPartial(false); setAmount(''); setMethodId(null); setError('') }
  }, [open, payment])

  const showModal = open || closing || wasOpenRef.current
  if (!showModal || !payment) return null

  const due = Number(payment.amount) || 0
  const debitOnly = methods.filter(m => m.kind !== 'credit')
  const parsed = parseFloat(amount)
  const valid = !isNaN(parsed) && parsed > 0
  const restante = valid ? Math.round((due - parsed) * 100) / 100 : 0
  const finalAmount = partial ? (valid ? Math.round(parsed * 100) / 100 : 0) : due

  function handleSave() {
    if (partial && !valid) { setError(t('cards.payNow.amountError')); return }
    onConfirm({ amount: finalAmount, methodId })
  }

  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()} className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`}>
      <div className={`${styles.modal} ${entering ? styles.modalEntering : ''} ${closing ? styles.modalClosing : ''}`}>
        <div className={styles.handle} />
        <div className={styles.title}>{title}</div>
        <div className={styles.subtitle}>{t('cards.payStatement.subtitle', { amount: fmt(due) })}</div>

        <div className={styles.fieldGroup}>
          <label className="field-label">{partial ? t('cards.payStatement.partialLabel') : t('cards.payStatement.fullLabel')}</label>
          {partial
            ? <AmountInput autoFocus className="field-input" value={amount} onChange={e => { setAmount(e.target.value); setError('') }} placeholder="0.00" />
            : <div className="field-input">{fmt(due)}</div>}
        </div>

        {partial && valid && (
          <div className={styles.note}>
            {parsed > due
              ? t('cards.payStatement.noteOver', { amount: fmt(Math.abs(restante)) })
              : parsed === due ? t('cards.payStatement.noteFull') : t('cards.payStatement.notePartial', { amount: fmt(restante) })}
          </div>
        )}

        <div className={styles.fieldGroup}>
          <PaymentMethodField methods={debitOnly} value={methodId} onChange={setMethodId} label={t('paymentMethod.payTitle')} />
        </div>

        <button type="button" className={styles.link} onClick={() => { setPartial(p => !p); setError('') }}>
          {partial ? t('cards.payStatement.switchFull') : t('cards.payStatement.switchPartial')}
        </button>

        {error && <div className={styles.errorText}>{error}</div>}

        <button type="button" onClick={handleSave} className="btn-primary">
          {t(partial ? 'cards.payStatement.confirmPartial' : 'cards.payStatement.confirmFull', { amount: fmt(finalAmount) })}
        </button>
        <button type="button" onClick={onClose} className={`btn-ghost ${styles.cancel}`}>{t('buttons.cancel')}</button>
      </div>
    </div>,
    document.body
  )
}
