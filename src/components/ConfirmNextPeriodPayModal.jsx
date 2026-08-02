import { useTranslation } from 'react-i18next'
import { dateOf, getMonths } from '../lib/utils'
import styles from './ConfirmNextPeriodPayModal.module.css'

// Confirmación antes de marcar como pagado un pago que en realidad vence en
// el PRÓXIMO periodo (riel de "Pagos del próximo periodo" en Home) —
// previene que alguien pague por error algo de un periodo que aún no
// arranca, confundido de qué switch tiene activo (Periodo actual / Próximo
// periodo). Se abre vía una Promise con resolver (mismo patrón que
// requestVariableAmount en App.jsx) — PayCard espera `true`/`false` antes
// de decidir si continúa con la animación de pagar. Mismo lenguaje visual
// que VariableAmountModal (overlay + panel centrado, z-index 250, animación
// modalPopIn) — sin ConfirmCloseModal de por medio, porque aquí no hay
// ningún dato capturado que se pueda perder al cancelar, solo una pregunta
// de sí/no.
export function ConfirmNextPeriodPayModal({ open, payment, onConfirm, onCancel }) {
  const { t } = useTranslation()
  if (!open || !payment) return null
  const d = dateOf(payment.due_date)

  return (
    <div onClick={e => e.target === e.currentTarget && onCancel()} className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.title}>{t('confirmNextPeriodPayModal.title')}</div>
        <div className={styles.description}>
          <strong>{payment.name}</strong> {t('confirmNextPeriodPayModal.descriptionPrefix', { day: d.getDate(), month: getMonths()[d.getMonth()] })} <strong>{t('confirmNextPeriodPayModal.nextPeriodPhrase')}</strong>. {t('confirmNextPeriodPayModal.descriptionSuffix')}
        </div>
        <button onClick={onConfirm} className={`btn-primary ${styles.confirmButton}`}>{t('confirmNextPeriodPayModal.confirm')}</button>
        <button onClick={onCancel} className="btn-ghost">{t('buttons.cancel')}</button>
      </div>
    </div>
  )
}
