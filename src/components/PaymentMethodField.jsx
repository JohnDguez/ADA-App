import { useTranslation } from 'react-i18next'
import { Wallet, CreditCard, Plus } from 'lucide-react'
import { Select } from './Select'
import { getBank, bankColorVar } from '../lib/cardCatalog'
import { upcomingCut } from '../lib/cardStatements'
import { cutDateLong } from '../lib/cutLabels'
import { dateOf, todayStr } from '../lib/utils'
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

// `allowCredit={false}`: sin tarjetas de crédito en la lista (aportar a metas y
// al Fondo Compartido — crédito no baja el disponible, así que el progreso
// y el disponible dejarían de cuadrar).
// `payDate` ('YYYY-MM-DD', opcional, v0.9.738): fecha del cargo; con tarjeta de
// crédito, si cae a 2 días o menos del corte (o el mismo día) se avisa a qué
// estado de cuenta entra. Por omisión, hoy.
const CUT_NOTICE_DAYS = 2

export function PaymentMethodField({ methods, value, onChange, label, onAddCard = null, allowCredit = true, sheet = false, payDate = null }) {
  const { t } = useTranslation()
  const debit = methods.filter(m => m.kind === 'debit')
  const credit = allowCredit ? methods.filter(m => m.kind === 'credit') : []

  const options = [
    { value: CASH_VALUE, label: t('paymentMethod.cash'), group: 'cash' },
    ...debit.map(m => ({ value: m.id, label: cardLabel(m, t), group: 'debit' })),
    ...credit.map(m => ({
      value: m.id, label: cardLabel(m, t), group: 'credit',
      sub: m.cut_day && m.due_day ? t('cards.cutAndDue', { cut: m.cut_day, due: m.due_day }) : undefined,
    })),
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

  // Aviso de corte cercano: el día del corte ya pertenece al ciclo siguiente.
  let cutNote = null
  if (selected?.kind === 'credit' && selected.cut_day) {
    const pay = dateOf(payDate || todayStr())
    const cut = upcomingCut(selected, pay)
    const left = cut ? Math.round((cut - pay) / 86400000) : null
    if (left !== null && left <= CUT_NOTICE_DAYS) {
      cutNote = t(left === 0 ? 'paymentMethod.cutSameDay' : 'paymentMethod.cutSoon', { date: cutDateLong(cut) })
    }
  }

  return (
    <>
      <label className="field-label">{label || t('paymentMethod.label')}</label>
      <div className={styles.row}>
        <div className={styles.selectWrap}>
          <Select
            value={value || CASH_VALUE}
            onChange={id => onChange(id === CASH_VALUE ? null : id)}
            options={options}
            groupLabels={groupLabels}
            renderIcon={renderIcon}
            sheet={sheet}
            sheetTitle={label || t('paymentMethod.label')}
          />
        </div>
        {/* Registrar una tarjeta sin salir del formulario (onAddCard abre
            CardFormModal encima; al guardar, el formulario conserva sus datos
            y deja la tarjeta nueva seleccionada). */}
        {onAddCard && (
          <button
            type="button"
            onClick={onAddCard}
            className={styles.addButton}
            aria-label={t('paymentMethod.addCard')}
            title={t('paymentMethod.addCard')}
          >
            <CreditCard size={18} color="var(--accent)" />
            <Plus size={11} strokeWidth={3} color="var(--accent)" className={styles.addBadge} />
          </button>
        )}
      </div>
      {cutNote && <div className={styles.cutNote}>{cutNote}</div>}
    </>
  )
}
