import { useTranslation } from 'react-i18next'
import { ModalSheet, SheetButton } from './ModalSheet'
import { SignOut } from '@phosphor-icons/react/dist/csr/SignOut'

// Confirmación al dar "atrás" estando en la primera pantalla de la sesión.
// Bottom sheet estándar (ModalSheet).
export function ConfirmExitModal({ open, onConfirm, onCancel }) {
  const { t } = useTranslation()
  return (
    <ModalSheet open={open} icon={SignOut} tone="danger" title={t('confirmExit.title')} onBackdrop={onCancel}>
      <ModalSheet.Text>{t('confirmExit.description')}</ModalSheet.Text>
      <SheetButton variant="danger" onClick={onConfirm}>{t('confirmExit.exit')}</SheetButton>
      <SheetButton variant="soft" onClick={onCancel}>{t('confirmExit.stay')}</SheetButton>
    </ModalSheet>
  )
}
