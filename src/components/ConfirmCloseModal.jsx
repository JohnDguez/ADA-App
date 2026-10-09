import { useTranslation } from 'react-i18next'
import { ModalSheet, SheetButton } from './ModalSheet'
import { Warning } from '@phosphor-icons/react/dist/csr/Warning'

export function ConfirmCloseModal({ open, onConfirm, onCancel }) {
  const { t } = useTranslation()
  return (
    <ModalSheet open={open} icon={Warning} tone="danger" title={t('confirmClose.title')} onBackdrop={onCancel} zIndex={400}>
      <ModalSheet.Text>{t('confirmClose.description')}</ModalSheet.Text>
      <SheetButton variant="danger" onClick={onConfirm}>{t('confirmClose.discard')}</SheetButton>
      <SheetButton variant="soft" onClick={onCancel}>{t('confirmClose.keepEditing')}</SheetButton>
    </ModalSheet>
  )
}
