import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import AmountInput from './AmountInput'
import { PaymentMethodField } from './PaymentMethodField'
import { fmt } from '../lib/utils'
import { CreditCard as CardIc } from '@phosphor-icons/react/dist/csr/CreditCard'
import { Modal } from './Modal'
import mk from './Modal.module.css'

// Pagar el estado de cuenta de una tarjeta desde Inicio (v0.9.740, mockup
// aprobado por Johnatan). Antes reutilizaba el modal de "monto variable":
// pedía el monto aunque se fuera a pagar completo y nunca preguntaba con qué
// se pagó. Ahora: monto fijo (lo debido) + "¿Con qué pagaste?" (solo Efectivo
// o Débito: pagar una tarjeta con otra no tiene sentido en este modelo), y el
// campo de monto solo aparece al tocar "Abonar otro monto". Misma animación
// que PayCardNowModal. Resuelve con
// { amount, methodId }; la diferencia contra lo debido la convierte en acarreo
// App.jsx → confirmVariablePaid.
export function PayStatementModal({ open, payment: paymentProp, title, methods, onConfirm, onClose }) {
  const { t } = useTranslation()
  const lastPay = useRef(null)
  if (paymentProp) lastPay.current = paymentProp
  const payment = paymentProp || lastPay.current
  const [partial, setPartial] = useState(false)
  const [amount, setAmount] = useState('')
  const [methodId, setMethodId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) { setPartial(false); setAmount(''); setMethodId(null); setError('') }
  }, [open, paymentProp])

  if (!payment) return null

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

  // Diseño nuevo (v0.9.980): acción rápida con <Modal layout="quick">.
  return (
    <Modal open={open} onClose={onClose} layout="quick" icon={CardIc} title={title}
      desc={t('cards.payStatement.subtitle', { amount: fmt(due) })} width={460}
      primary={{ label: t(partial ? 'cards.payStatement.confirmPartial' : 'cards.payStatement.confirmFull', { amount: fmt(finalAmount) }), onClick: handleSave }}>
      <div className={mk.pan}>
        <div className={mk.lab}>{partial ? t('cards.payStatement.partialLabel') : t('cards.payStatement.fullLabel')}</div>
        <div key={partial ? 'p' : 'f'} className={mk.swap}>
          {partial
            ? <label className={mk.amount}><small>$</small><AmountInput autoFocus value={amount} onChange={e => { setAmount(e.target.value); setError('') }} placeholder="0.00" onKeyDown={e => e.key === 'Enter' && handleSave()} /></label>
            : <div className={mk.amount}><small>$</small><input readOnly tabIndex={-1} value={fmt(due).replace(/^[^\d]*/, '')} /></div>}
        </div>
        <PaymentMethodField methods={debitOnly} value={methodId} onChange={setMethodId} label={t('paymentMethod.payTitle')} />
        <button type="button" className={mk.link} onClick={() => { setPartial(p => !p); setError('') }}>
          {partial ? t('cards.payStatement.switchFull') : t('cards.payStatement.switchPartial')}
        </button>
        {error && <div className={mk.err}>{error}</div>}
      </div>
      {partial && valid && (
        <div className={mk.note}>
          {parsed > due
            ? t('cards.payStatement.noteOver', { amount: fmt(Math.abs(restante)) })
            : parsed === due ? t('cards.payStatement.noteFull') : t('cards.payStatement.notePartial', { amount: fmt(restante) })}
        </div>
      )}
    </Modal>
  )
}
