import { useTranslation } from 'react-i18next'
import { Wallet } from 'lucide-react'
import { Select } from './Select'
import { getBank, bankColorVar } from '../lib/cardCatalog'
import styles from './PaymentMethodField.module.css'

// "Se paga con" (v0.9.487, entrega B). Efectivo (valor null) + las tarjetas
// de Mis tarjetas, agrupadas en Débito y Crédito. Es un desplegable, no
// botones: con muchas tarjetas se saturaba (pedido de Johnatan).
// Solo pagos personales: las tarjetas no se comparten en un Espacio
// Compartido.
export const CASH_VALUE = 'cash'

export function cardLabel(card, t) {
  const bank = getBank(card.bank)
  const name = bank.id === 'otro' ? t('cards.otherBank') : bank.name
  return [name, card.alias, card.last4 ? `•••• ${card.last4}` : null].filter(Boolean).join(' · ')
}

export function PaymentMethodField({ methods, value, onChange, label }) {
  const { t } = useTranslation()
  const debit = methods.filter(m => m.kind === 'debit')
  const credit = methods.filter(m => m.kind === 'credit')

  const options = [
    { value: CASH_VALUE, label: t('paymentMethod.cash'), group: 'cash' },
    ...debit.map(m => ({ value: m.id, label: cardLabel(m, t), group: 'debit' })),
    ...credit.map(m => ({ value: m.id, label: cardLabel(m, t), group: 'credit' })),
  ]

  const groupLabels = {
    cash: t('paymentMethod.groupCash'),
    debit: t('cards.kind.debit'),
    credit: t('cards.kind.credit'),
  }

  function renderIcon(id) {
    if (id === CASH_VALUE) return <Wallet size={14} color="var(--text)" className={styles.icon} />
    return <span className={styles.swatch} style={{ '--swatch-color': bankColorVar(methods.find(m => m.id === id)?.bank) }} />
  }

  const selected = methods.find(m => m.id === value)

  return (
    <>
      <label className="field-label">{label || t('paymentMethod.label')}</label>
      <Select
        value={value || CASH_VALUE}
        onChange={id => onChange(id === CASH_VALUE ? null : id)}
        options={options}
        groupLabels={groupLabels}
        renderIcon={renderIcon}
      />
      {selected?.kind === 'credit' && (
        <div className={styles.note}>{t('paymentMethod.creditNote')}</div>
      )}
    </>
  )
}
