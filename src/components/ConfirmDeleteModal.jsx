import { useTranslation } from 'react-i18next'
import styles from './ConfirmDeleteModal.module.css'

// Modal de confirmación genérico para cualquier borrado de pago — mismo
// patrón visual que ConfirmCloseModal.jsx (overlay + tarjeta centrada),
// pero con mensaje dinámico por caller vía `getDeleteConfirmMessage()`
// (lib/utils.js), que arma el texto correcto según el tipo de pago:
// master, copia de recurrente, parcialidad con/sin master, o pago único.
//
// Reemplaza el confirm() nativo del navegador que usaban PayCard.jsx,
// PaymentModal.jsx y PaymentsPage.jsx — bug real reportado por Johnatan:
// ninguna pantalla debe depender del alert nativo, cada una necesita su
// propia UI de confirmación. RecurrentsPage.jsx/RecurrentDetailPanel.jsx
// ya tenían la suya propia (panel inline, no este modal centrado) desde
// antes — se quedan igual, no las duplica este componente.
export function ConfirmDeleteModal({ open, message, onConfirm, onCancel }) {
  const { t } = useTranslation()
  if (!open) return null
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.title}>{t('paymentModal.deletePayment')}</div>
        <div className={styles.description}>{message}</div>
        <button type="button" onClick={onConfirm} className={styles.discardButton}>{t('buttons.delete')}</button>
        <button type="button" onClick={onCancel} className={styles.cancelButton}>{t('buttons.cancel')}</button>
      </div>
    </div>
  )
}
