import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import AmountInput from './AmountInput'
import { PaymentMethodField } from './PaymentMethodField'
import { fmt } from '../lib/utils'
import { useAnchor } from './AnchoredPop'
import { QuickModal } from './Modal'
import mk from './Modal.module.css'
import { CreditCard as CardIc } from '@phosphor-icons/react/dist/csr/CreditCard'
import { useIsMobile } from '../hooks/useIsMobile'

// "Pagar ahora" (v0.9.497, mockups confirmados con Johnatan) — adelantar
// el pago de una tarjeta de crédito ANTES de que llegue su corte, en vez
// de esperar a que la app genere el estado de cuenta automático. El monto
// se precarga con lo gastado en el ciclo en curso, pero es editable: pagar
// menos es un abono parcial, pagar más es un adelanto a favor. Solo
// Efectivo o Débito — pagar una tarjeta de crédito con otra no tiene
// sentido en este modelo (el crédito nunca baja el disponible).

export function PayCardNowModal({ open, card, cycleSpend, methods, onSave, onClose, title = null, subtitle = null, fixedAmount = false }) {
  const { t } = useTranslation()
  // Móvil: hoja; tablet: diálogo; escritorio: popover anclado al botón que lo
  // abrió (sin ancla, diálogo). Todo con <QuickModal> (v0.9.980). El monto
  // arranca vacío en móvil (monto personalizado) con atajo «Todo».
  const mobile = useIsMobile()
  const anchorRef = useAnchor(open)
  const lastCard = useRef(card)
  if (card) lastCard.current = card
  const [amount, setAmount] = useState('')
  const [methodId, setMethodId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setAmount(cycleSpend > 0 && !(mobile && !fixedAmount) ? String(cycleSpend) : '')
      setMethodId(null)
      setError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cycleSpend])

  const c = card || lastCard.current
  if (!c) return null
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

  return (
    <QuickModal open={open} onClose={onClose} anchorRef={anchorRef} icon={CardIc}
      title={title || t('cards.payNow.title', { name: c.alias || t(`cards.kind.${c.kind}`) })}
      desc={subtitle || (cycleSpend > 0 ? t('cards.payNow.subtitle', { amount: fmt(cycleSpend) }) : t('cards.payNow.subtitleZero'))}
      primary={{ label: t('cards.payNow.confirm'), onClick: handleSave, disabled: isZero }}>
      <div className={mk.pan}>
        <div className={mk.lab}>{t('cards.payNow.amountLabel')}</div>
        {fixedAmount
          ? <div className={mk.amount}><small>$</small><input readOnly value={fmt(cycleSpend).replace(/^[^\d]*/, '')} /></div>
          : (
            <label className={mk.amount}>
              <small>$</small>
              <AmountInput value={amount} onChange={e => { setAmount(e.target.value); setError('') }} placeholder="0.00" onKeyDown={e => e.key === 'Enter' && handleSave()} />
            </label>
          )}
        {!fixedAmount && cycleSpend > 0 && (
          <div className={mk.chips}>
            <button type="button" className={`${mk.chip} ${parsed === cycleSpend ? mk.chipOn : ''}`} onClick={() => { setAmount(String(cycleSpend)); setError('') }}>
              {t('cards.mobile.quickAll', { amount: fmt(cycleSpend) })}
            </button>
          </div>
        )}
        <PaymentMethodField methods={debitOnly} value={methodId} onChange={setMethodId} label={t('paymentMethod.label')} />
        {error && <div className={mk.err}>{error}</div>}
      </div>
      {!isZero && !fixedAmount && (
        <div className={mk.note}>
          {isFull ? t('cards.payNow.noteFull') : parsed > cycleSpend ? t('cards.payNow.noteOver') : t('cards.payNow.notePartial', { amount: fmt(restante) })}
        </div>
      )}
    </QuickModal>
  )
}
