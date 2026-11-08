import { useTranslation } from 'react-i18next'
import styles from './AmountKindSwitch.module.css'

// Selector «Monto fijo | Monto variable» (v0.9.1037, mockup aprobado). Vive dentro de la
// tarjeta del monto, en Único y Recurrente, en los tres tamaños (Regla 76): el
// usuario decide ahí mismo si el monto se conoce o se indicará al pagar.
export default function AmountKindSwitch({ value, onChange, disabled = false }) {
  const { t } = useTranslation()
  const opts = [[false, 'paymentModal.amountKind.fixed'], [true, 'paymentModal.amountKind.variable']]
  return (
    <div className={styles.switch} role="radiogroup" aria-label={t('paymentModal.amountKind.label')} data-coachmark="modal-variable-toggle"
      onClick={e => e.stopPropagation()}>
      {opts.map(([v, key]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={value === v} disabled={disabled}
          className={`${styles.opt} ${value === v ? styles.on : ''}`} onClick={() => onChange(v)}>
          {t(key)}
        </button>
      ))}
    </div>
  )
}
