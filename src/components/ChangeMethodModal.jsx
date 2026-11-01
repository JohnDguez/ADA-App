import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CreditCard as CardIc } from '@phosphor-icons/react/dist/csr/CreditCard'
import { AddCardModal } from './AddCardModal'
import { useAnchor } from './AnchoredPop'
import { QuickModal } from './Modal'
import { MethodList } from './MethodList'
import { fmt } from '../lib/utils'

// "Cambiar método de pago" (v0.9.487) — desde el menú de 3 puntos de un
// pago. Cambia SOLO ese pago (una copia de un recurrente no arrastra al
// master: se usa para el mes que se pagó distinto).

export function ChangeMethodModal({ open, payment: paymentProp, methods, onSave, onClose, title, confirmLabel, paymentMethods = null }) {
  const { t } = useTranslation()
  // Móvil: hoja; tablet: diálogo; escritorio: popover anclado al botón que lo
  // abrió (<QuickModal>, v0.9.980). Lista de métodos con un toque.
  const anchorRef = useAnchor(open, paymentProp?.id)
  const lastPay = useRef(null)
  if (paymentProp) lastPay.current = paymentProp
  const payment = paymentProp || lastPay.current
  const [methodId, setMethodId] = useState(null)
  const [cardFormOpen, setCardFormOpen] = useState(false)

  useEffect(() => {
    if (open) setMethodId(payment?.payment_method_id || null)
  }, [open, payment])

  if (!payment) return null

  function handleSave() {
    const card = methods.find(m => m.id === methodId)
    onSave(payment, {
      payment_method_id: card ? card.id : null,
      payment_method_kind: card ? card.kind : 'cash',
    })
  }

  return (
    <>
      <QuickModal open={open} onClose={onClose} anchorRef={anchorRef} icon={CardIc}
        title={title || t('paymentMethod.changeTitle')}
        desc={payment.amount ? `${payment.name} · ${fmt(payment.amount)}` : payment.name}
        primary={{ label: confirmLabel || t('buttons.save'), onClick: handleSave }}>
        <MethodList methods={methods} value={methodId} onChange={setMethodId} onAddCard={paymentMethods ? () => setCardFormOpen(true) : null} />
      </QuickModal>
      {paymentMethods && (
        <AddCardModal open={cardFormOpen} onClose={() => setCardFormOpen(false)} paymentMethods={paymentMethods} onAdded={setMethodId} />
      )}
    </>
  )
}
