import { useTranslation } from 'react-i18next'
import { getBank, bankColorVar } from '../lib/cardCatalog'
import { CardNetworkIcon } from './CardNetworkIcon'
import styles from './CreditCardVisual.module.css'

// Tarjeta visual de Mis tarjetas (v0.9.486, entrega A) — vista previa del
// formulario y cada tarjeta de las pilas. Toma el color de la institución
// (`--bank-<id>` en index.css) y cambia con un fundido cuando se elige otro
// banco (transition de background-color; el degradado es una capa encima,
// así el cambio de color sí se anima). Nunca muestra un número completo:
// solo los últimos 4 dígitos, si el usuario los dio.
export function CreditCardVisual({ card, className = '' }) {
  const { t } = useTranslation()
  const bank = getBank(card.bank)
  const isCredit = card.kind === 'credit'
  const isDigital = card.form === 'digital'

  return (
    <div
      className={`${styles.card} ${bank.darkText ? styles.darkText : ''} ${className}`}
      style={{ '--card-color': bankColorVar(card.bank) }}
    >
      <div className={styles.top}>
        <div className={styles.names}>
          <div className={styles.bankName}>{bank.id === 'otro' ? t('cards.otherBank') : bank.name}</div>
          {card.alias ? <div className={styles.alias}>{card.alias}</div> : null}
        </div>
        {isDigital
          ? <span className={styles.badge}>{t('cards.form.digital')}</span>
          : <span className={styles.chip} />}
      </div>

      <div className={styles.number}>{card.last4 ? `•••• ${card.last4}` : ''}</div>

      <div className={styles.bottom}>
        <span className={styles.meta}>
          {isCredit && card.cut_day && card.due_day
            ? t('cards.cutAndDue', { cut: card.cut_day, due: card.due_day })
            : t(isCredit ? 'cards.kind.credit' : 'cards.kind.debit')}
        </span>
        <CardNetworkIcon network={card.network} size={30} className={styles.network} />
      </div>
    </div>
  )
}
