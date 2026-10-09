import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Tag } from '@phosphor-icons/react/dist/csr/Tag'
import { ModalSheet, SheetButton } from './ModalSheet'
import { CATEGORIES, getCategoryLabel } from '../lib/utils'
import styles from './AddCategoryModal.module.css'

// "Nueva categoría" desde el formulario de pago: hoja encima del formulario
// (que sigue montado y no pierde lo capturado), igual que "Añadir tarjeta".
// Al guardar entrega el nombre con `onAdded` para dejarlo seleccionado. Si el
// nombre ya existe (de fábrica o propia) no se duplica: solo se selecciona.
export function AddCategoryModal({ open, onClose, customCategories = [], onAdd, onAdded }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (open) { setName(''); setSaving(false) } }, [open])
  if (!open) return null

  async function handleSave() {
    const cat = name.trim()
    if (!cat || saving) return
    setSaving(true)
    const norm = s => s.trim().toLowerCase()
    const existing = [...CATEGORIES.map(c => ({ value: c, label: getCategoryLabel(c) })), ...customCategories.map(c => ({ value: c, label: c }))]
      .find(o => norm(o.label) === norm(cat) || norm(o.value) === norm(cat))
    if (existing) { onAdded?.(existing.value); onClose(); return }
    await onAdd?.(cat)
    onAdded?.(cat)
    onClose()
  }

  return (
    <ModalSheet icon={Tag} title={t('paymentModal.fields.newCategoryTitle')} onBackdrop={onClose} zIndex={450}>
      <input
        autoFocus
        className={`field-input ${styles.input}`}
        placeholder={t('paymentModal.fields.categoryNamePlaceholder')}
        value={name}
        maxLength={30}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose() }}
      />
      <SheetButton onClick={handleSave} disabled={!name.trim() || saving}>{t('paymentModal.fields.add')}</SheetButton>
      <SheetButton variant="soft" onClick={onClose}>{t('buttons.cancel')}</SheetButton>
    </ModalSheet>
  )
}
