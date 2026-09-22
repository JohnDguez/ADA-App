import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { PaymentMethodField } from './PaymentMethodField'
import styles from './ChangeMethodModal.module.css'

// "Cambiar método de pago" (v0.9.487) — desde el menú de 3 puntos de un
// pago. Cambia SOLO ese pago (una copia de un recurrente no arrastra al
// master: se usa para el mes que se pagó distinto). Entrada y salida
// animadas; ANIM_MS debe coincidir con el CSS (Regla 30).
const ANIM_MS = 320

export function ChangeMethodModal({ open, payment, methods, onSave, onClose }) {
  const { t } = useTranslation()
  const [methodId, setMethodId] = useState(null)
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
    if (open) setMethodId(payment?.payment_method_id || null)
  }, [open, payment])

  const showModal = open || closing || wasOpenRef.current
  if (!showModal || !payment) return null

  function handleSave() {
    const card = methods.find(m => m.id === methodId)
    onSave(payment, {
      payment_method_id: card ? card.id : null,
      payment_method_kind: card ? card.kind : 'cash',
    })
  }

  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()} className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`}>
      <div className={`${styles.modal} ${entering ? styles.modalEntering : ''} ${closing ? styles.modalClosing : ''}`}>
        <div className={styles.handle} />
        <div className={styles.title}>{t('paymentMethod.changeTitle')}</div>
        <div className={styles.subtitle}>{payment.name}</div>
        <div className={styles.field}>
          <PaymentMethodField methods={methods} value={methodId} onChange={setMethodId} />
        </div>
        <button type="button" onClick={handleSave} className="btn-primary">{t('buttons.save')}</button>
        <button type="button" onClick={onClose} className={`btn-ghost ${styles.cancel}`}>{t('buttons.cancel')}</button>
      </div>
    </div>,
    document.body
  )
}
