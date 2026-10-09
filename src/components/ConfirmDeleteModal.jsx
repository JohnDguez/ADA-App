import { useTranslation } from 'react-i18next'
import { ModalSheet, SheetButton } from './ModalSheet'
import { Trash } from '@phosphor-icons/react/dist/csr/Trash'

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
// `title` opcional (v0.9.486, Mis tarjetas): por defecto sigue siendo
// "Eliminar pago", como en todos los usos que ya existían.
export function ConfirmDeleteModal({ open, title, message, onConfirm, onCancel }) {
  const { t } = useTranslation()
  return (
    <ModalSheet open={open} icon={Trash} tone="danger" title={title || t('paymentModal.deletePayment')} onBackdrop={onCancel} zIndex={400}>
      <ModalSheet.Text>{message}</ModalSheet.Text>
      <SheetButton variant="danger" onClick={onConfirm}>{t('buttons.delete')}</SheetButton>
      <SheetButton variant="soft" onClick={onCancel}>{t('buttons.cancel')}</SheetButton>
    </ModalSheet>
  )
}
