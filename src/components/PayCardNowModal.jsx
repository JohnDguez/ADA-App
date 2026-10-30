import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import AmountInput from './AmountInput'
import { PaymentMethodField } from './PaymentMethodField'
import { fmt } from '../lib/utils'
import styles from './PayCardNowModal.module.css'
import { useScrollLock } from '../lib/scrollLock'
import { AnchoredPop, useAnchor } from './AnchoredPop'
import { X } from 'lucide-react'
import { CreditCard as CardIc } from '@phosphor-icons/react/dist/csr/CreditCard'
import { useIsMobile } from '../hooks/useIsMobile'

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

export function PayCardNowModal({ open, card, cycleSpend, methods, onSave, onClose, title = null, subtitle = null, fixedAmount = false }) {
  useScrollLock(open)
  const { t } = useTranslation()
  // Tablet y escritorio (≥768px, v0.9.953): popover anclado al botón que lo abrió; sin
  // ancla (apertura por código) cae a la hoja de siempre.
  // Móvil (v0.9.922): el monto arranca vacío (monto personalizado) con un atajo "Todo";
  // v0.9.953: hoja con el diseño nuevo (ícono, cerrar, monto grande).
  const mobile = useIsMobile()
  const desk = !mobile
  const anchorRef = useAnchor(open)
  const lastCard = useRef(card)
  if (card) lastCard.current = card
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
      setAmount(cycleSpend > 0 && !(mobile && !fixedAmount) ? String(cycleSpend) : '')
      setMethodId(null)
      setError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cycleSpend])

  const showModal = open || closing || wasOpenRef.current
  if (desk && anchorRef.current) { if (!lastCard.current) return null } else if (!showModal || !card) return null

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

  const c = card || lastCard.current
  const mForm = (
    <>
      <div className={styles.mHead}>
        <i className={styles.mIco}><CardIc size={22} /></i>
        <div className={styles.mTxt}>
          <div className={styles.mTitle}>{title || t('cards.payNow.title', { name: c.alias || t(`cards.kind.${c.kind}`) })}</div>
          <div className={styles.mSub}>
            {subtitle || (cycleSpend > 0 ? t('cards.payNow.subtitle', { amount: fmt(cycleSpend) }) : t('cards.payNow.subtitleZero'))}
          </div>
        </div>
        <button type="button" className={styles.mClose} onClick={onClose} aria-label={t('buttons.cancel')}><X size={18} /></button>
      </div>

      <div className={styles.mCap}>{t('cards.payNow.amountLabel')}</div>
      {fixedAmount
        ? <div className={styles.mBox}><span>$</span><b>{fmt(cycleSpend).replace(/^[^\d]*/, '')}</b></div>
        : (
          <label className={styles.mBox}>
            <span>$</span>
            <AmountInput className={styles.mInput} value={amount} onChange={e => { setAmount(e.target.value); setError('') }} placeholder="0.00" />
          </label>
        )}
      {!fixedAmount && cycleSpend > 0 && (
        <div className={styles.quick}>
          <button type="button" className={`${styles.chip} ${parsed === cycleSpend ? styles.chipOn : ''}`} onClick={() => { setAmount(String(cycleSpend)); setError('') }}>
            {t('cards.mobile.quickAll', { amount: fmt(cycleSpend) })}
          </button>
        </div>
      )}

      <div className={styles.mField}>
        <PaymentMethodField methods={debitOnly} value={methodId} onChange={setMethodId} label={t('paymentMethod.label')} />
      </div>

      {!isZero && !fixedAmount && (
        <div className={styles.note}>
          {isFull ? t('cards.payNow.noteFull') : parsed > cycleSpend ? t('cards.payNow.noteOver') : t('cards.payNow.notePartial', { amount: fmt(restante) })}
        </div>
      )}
      {error && <div className={styles.errorText}>{error}</div>}

      <div className={styles.mBtns}>
        <button type="button" onClick={onClose} className={styles.mCancel}>{t('buttons.cancel')}</button>
        <button type="button" onClick={handleSave} className={`btn-primary ${styles.mOk}`} disabled={isZero}>{t('cards.payNow.confirm')}</button>
      </div>
    </>
  )
  const form = (
    <>
        <div className={styles.title}>{title || t('cards.payNow.title', { name: c.alias || t(`cards.kind.${c.kind}`) })}</div>
        <div className={styles.subtitle}>
          {subtitle || (cycleSpend > 0
            ? t('cards.payNow.subtitle', { amount: fmt(cycleSpend) })
            : t('cards.payNow.subtitleZero'))}
        </div>

        <div className={styles.fieldGroup}>
          <label className="field-label">{t('cards.payNow.amountLabel')}</label>
          {fixedAmount
            ? <div className="field-input">{fmt(cycleSpend)}</div>
            : <AmountInput className="field-input" value={amount} onChange={e => { setAmount(e.target.value); setError('') }} placeholder="0.00" />}
          {mobile && !fixedAmount && cycleSpend > 0 && (
            <div className={styles.quick}>
              <button type="button" className={`${styles.chip} ${parsed === cycleSpend ? styles.chipOn : ''}`} onClick={() => { setAmount(String(cycleSpend)); setError('') }}>
                {t('cards.mobile.quickAll', { amount: fmt(cycleSpend) })}
              </button>
            </div>
          )}
        </div>

        <div className={styles.fieldGroup}>
          <PaymentMethodField methods={debitOnly} value={methodId} onChange={setMethodId} label={t('paymentMethod.label')} />
        </div>

        {!isZero && !fixedAmount && (
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
    </>
  )

  if (desk && anchorRef.current) {
    return <AnchoredPop open={!!open} onClose={onClose} anchorRef={anchorRef} width={380} label={t('cards.payNow.button')}>{form}</AnchoredPop>
  }

  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()} className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`}>
      <div className={`${styles.modal} ${entering ? styles.modalEntering : ''} ${closing ? styles.modalClosing : ''}`}>
        <div className={styles.handle} />
        {mobile ? mForm : form}
      </div>
    </div>,
    document.body
  )
}
