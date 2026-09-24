import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import AmountInput from './AmountInput'
import { PaymentMethodField } from './PaymentMethodField'
import { fmt } from '../lib/utils'
import styles from './PayCardNowModal.module.css'

// "Pagar ahora" (v0.9.497, mockups confirmados con Johnatan) — adelantar
// el pago de una tarjeta de crédito ANTES de que llegue su corte, en vez
// de esperar a que la app genere el estado de cuenta automático. El monto
// se precarga con lo gastado en el ciclo en curso, pero es editable: pagar
// menos es un abono parcial, pagar más es un adelanto a favor. Solo
// Efectivo o Débito — pagar una tarjeta de crédito con otra no tiene
// sentido en este modelo (el crédito nunca baja el disponible).
// Entrada y salida animadas (Regla 29); ANIM_MS debe coincidir con el CSS
// (Regla 30).
const ANIM_MS = 320

export function PayCardNowModal({ open, card, cycleSpend, methods, onSave, onClose }) {
  const { t } = useTranslation()
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
    if (open) {
      setAmount(cycleSpend > 0 ? String(cycleSpend) : '')
      setMethodId(null)
      setError('')
    }
  }, [open, cycleSpend])

  const showModal = open || closing || wasOpenRef.current
  if (!showModal || !card) return null

  // Nunca otra tarjeta de crédito — solo Efectivo o Débito (ver nota arriba).
  const debitOnly = methods.filter(m => m.kind !== 'credit')

  const parsed = parseFloat(amount)
  const isFull = parsed === cycleSpend
  const isZero = !parsed || parsed <= 0
  const restante = Math.round((cycleSpend - (parsed || 0)) * 100) / 100

  function handleSave() {
    if (isZero || isNaN(parsed)) { setError(t('cards.payNow.amountError')); return }
    onSave({ amount: Math.round(parsed * 100) / 100, methodId })
  }

  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()} className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`}>
      <div className={`${styles.modal} ${entering ? styles.modalEntering : ''} ${closing ? styles.modalClosing : ''}`}>
        <div className={styles.handle} />
        <div className={styles.title}>{t('cards.payNow.title', { name: card.alias || t(`cards.kind.${card.kind}`) })}</div>
        <div className={styles.subtitle}>
          {cycleSpend > 0
            ? t('cards.payNow.subtitle', { amount: fmt(cycleSpend) })
            : t('cards.payNow.subtitleZero')}
        </div>

        <div className={styles.fieldGroup}>
          <label className="field-label">{t('cards.payNow.amountLabel')}</label>
          <AmountInput className="field-input" value={amount} onChange={e => { setAmount(e.target.value); setError('') }} placeholder="0.00" />
        </div>

        <div className={styles.fieldGroup}>
          <PaymentMethodField methods={debitOnly} value={methodId} onChange={setMethodId} label={t('paymentMethod.label')} />
        </div>

        {!isZero && (
          <div className={styles.note}>
            {isFull
              ? t('cards.payNow.noteFull')
              : parsed > cycleSpend
                ? t('cards.payNow.noteOver')
                : t('cards.payNow.notePartial', { amount: fmt(restante) })}
          </div>
        )}

        {error && <div className={styles.errorText}>{error}</div>}

        <button type="button" onClick={handleSave} className="btn-primary">{t('cards.payNow.confirm')}</button>
        <button type="button" onClick={onClose} className={`btn-ghost ${styles.cancel}`}>{t('buttons.cancel')}</button>
      </div>
    </div>,
    document.body
  )
}
