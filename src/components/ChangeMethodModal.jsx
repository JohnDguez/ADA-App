import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { PaymentMethodField } from './PaymentMethodField'
import { AddCardModal } from './AddCardModal'
import styles from './ChangeMethodModal.module.css'
import { useScrollLock } from '../lib/scrollLock'
import { AnchoredPop, useAnchor } from './AnchoredPop'
import { useIsDesktop } from '../hooks/useIsDesktop'

// "Cambiar método de pago" (v0.9.487) — desde el menú de 3 puntos de un
// pago. Cambia SOLO ese pago (una copia de un recurrente no arrastra al
// master: se usa para el mes que se pagó distinto). Entrada y salida
// animadas; ANIM_MS debe coincidir con el CSS (Regla 30).
const ANIM_MS = 320

export function ChangeMethodModal({ open, payment: paymentProp, methods, onSave, onClose, title, confirmLabel, paymentMethods = null }) {
  const { t } = useTranslation()
  // Escritorio (≥1100px, v0.9.927): popover anclado al botón que lo abrió (la
  // nueva tarjeta se abre en un diálogo, que queda por encima — z 200 vs 190).
  // Sin ancla, o en móvil/tablet, sigue siendo la hoja de siempre.
  const desk = useIsDesktop()
  const anchorRef = useAnchor(open)
  const asPop = desk && !!anchorRef.current
  const lastPay = useRef(null)
  if (paymentProp) lastPay.current = paymentProp
  const payment = paymentProp || lastPay.current
  useScrollLock(open && !asPop)
  const [methodId, setMethodId] = useState(null)
  const [cardFormOpen, setCardFormOpen] = useState(false)
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

  if (asPop) {
    return (
      <>
        <AnchoredPop open={!!open} onClose={onClose} anchorRef={anchorRef} width={380} label={title || t('paymentMethod.changeTitle')}>
          <h2 className={styles.deskTitle}>{title || t('paymentMethod.changeTitle')}</h2>
          <div className={styles.deskSub}>{payment.name}</div>
          <div className={styles.deskField}>
            <PaymentMethodField methods={methods} value={methodId} onChange={setMethodId} onAddCard={paymentMethods ? () => setCardFormOpen(true) : null} />
          </div>
          <div className={styles.deskFoot}>
            <button type="button" onClick={onClose} className={styles.deskCancel}>{t('buttons.cancel')}</button>
            <button type="button" onClick={handleSave} className={`btn-primary ${styles.deskSave}`}>{confirmLabel || t('buttons.save')}</button>
          </div>
        </AnchoredPop>
        {paymentMethods && (
          <AddCardModal open={cardFormOpen} onClose={() => setCardFormOpen(false)} paymentMethods={paymentMethods} onAdded={setMethodId} />
        )}
      </>
    )
  }

  return createPortal(
    <>
    <div onClick={e => e.target === e.currentTarget && onClose()} className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`}>
      <div className={`${styles.modal} ${entering ? styles.modalEntering : ''} ${closing ? styles.modalClosing : ''}`}>
        <div className={styles.handle} />
        <div className={styles.title}>{title || t('paymentMethod.changeTitle')}</div>
        <div className={styles.subtitle}>{payment.name}</div>
        <div className={styles.field}>
          <PaymentMethodField methods={methods} value={methodId} onChange={setMethodId} onAddCard={paymentMethods ? () => setCardFormOpen(true) : null} />
        </div>
        <button type="button" onClick={handleSave} className="btn-primary">{confirmLabel || t('buttons.save')}</button>
        <button type="button" onClick={onClose} className={`btn-ghost ${styles.cancel}`}>{t('buttons.cancel')}</button>
      </div>
    </div>
    {paymentMethods && (
      <AddCardModal open={cardFormOpen} onClose={() => setCardFormOpen(false)} paymentMethods={paymentMethods} onAdded={setMethodId} />
    )}
    </>,
    document.body
  )
}
