import { dateOf, MONTHS } from '../lib/utils'
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
  if (!open || !payment) return null
  const d = dateOf(payment.due_date)

  return (
    <div onClick={e => e.target === e.currentTarget && onCancel()} className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.title}>¿Marcar como pagado?</div>
        <div className={styles.description}>
          <strong>{payment.name}</strong> vence el {d.getDate()} de {MONTHS[d.getMonth()]}, dentro del <strong>próximo periodo</strong>. ¿Seguro que quieres marcarlo como pagado ahora?
        </div>
        <button onClick={onConfirm} className={`btn-primary ${styles.confirmButton}`}>Sí, marcar pagado</button>
        <button onClick={onCancel} className="btn-ghost">Cancelar</button>
      </div>
    </div>
  )
}
