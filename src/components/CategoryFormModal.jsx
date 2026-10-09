import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Search } from 'lucide-react'
import { CATEGORIES, getCatColor, getCategoryLabel } from '../lib/utils'
import { CATEGORY_ICON_GROUPS, getIconComponent } from '../lib/categoryIcons'
import { showToast } from './Toast'
import { supabase } from '../lib/supabase'
import { useBackClose } from '../lib/backNav'
import styles from '../pages/settings/SettingsCategoriesPage.module.css'
import { usePresence } from '../lib/usePresence'
import { useScrollLock } from '../lib/scrollLock'

export const CATEGORY_PALETTE = Array.from({ length: 16 }, (_, i) => `var(--palette-${i + 1})`)

// Modal completo de categoría (nombre + ícono + color), compartido por
// Ajustes → Categorías y por "Nueva categoría" del formulario de pago, para
// que sea EXACTAMENTE el mismo en los dos lados (v0.9.611).
// `editingCat` = { name, isCustom } para editar, o null para agregar.
// `onSaved(nombre)` avisa el nombre final (el formulario de pago lo deja
// seleccionado). Las 11 categorías fijas solo permiten ícono/color.
export function CategoryFormModal({ open, onClose, editingCat = null, profile, onUpdate, onSaved, zIndex }) {
  const { t } = useTranslation()
  const [formName,   setFormName]   = useState('')
  const [formIcon,   setFormIcon]   = useState('')
  const [formColor,  setFormColor]  = useState('')
  const [iconSearch, setIconSearch] = useState('')
  const [nameError,  setNameError]  = useState('')
  const [saving,     setSaving]     = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting,  setDeleting]    = useState(false)
  const [deleteCount, setDeleteCount] = useState(null) // pagos que se reasignarán, o null mientras carga

  const customCats     = profile.custom_categories || []
  const categoryIcons  = profile.category_icons || {}
  const categoryColors = profile.category_colors || {}

  useBackClose(open, onClose)
  const { render, closing } = usePresence(open)
  useScrollLock(open)

  useEffect(() => {
    if (!open) return
    if (editingCat) {
      setFormName(editingCat.name)
      setFormIcon(categoryIcons[editingCat.name] || '')
      setFormColor(getCatColor(editingCat.name, customCats, categoryColors))
    } else {
      setFormName(''); setFormIcon(''); setFormColor(CATEGORY_PALETTE[0])
    }
    setIconSearch(''); setNameError(''); setSaving(false); setConfirmingDelete(false); setDeleting(false); setDeleteCount(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingCat])

  if (!render) return null

  async function handleSave() {
    const trimmed = formName.trim()
    if (!trimmed) { setNameError(t('settingsCategories.toast.emptyName')); return }

    const oldName  = editingCat?.name
    const isNew    = !editingCat
    const isRename = editingCat?.isCustom && trimmed !== oldName

    const others = [...CATEGORIES, ...customCats].filter(c => c !== oldName)
    if (others.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setNameError(t('settingsCategories.toast.duplicateName')); return
    }

    setSaving(true)

    const updates = {}
    if (isNew)    updates.custom_categories = [...customCats, trimmed]
    if (isRename) updates.custom_categories = customCats.map(c => c === oldName ? trimmed : c)

    const newIcons = { ...categoryIcons }
    if (oldName && oldName !== trimmed && newIcons[oldName]) { newIcons[trimmed] = newIcons[oldName]; delete newIcons[oldName] }
    if (formIcon) newIcons[trimmed] = formIcon
    updates.category_icons = newIcons

    const newColors = { ...categoryColors }
    if (oldName && oldName !== trimmed && newColors[oldName]) { newColors[trimmed] = newColors[oldName]; delete newColors[oldName] }
    if (formColor) newColors[trimmed] = formColor
    updates.category_colors = newColors

    await onUpdate(updates)

    if (isRename) {
      await supabase.from('payments').update({ category: trimmed }).eq('user_id', profile.id).eq('category', oldName)
      showToast(`${t('settingsCategories.toast.renamedPrefix')} "${trimmed}"`)
    } else if (isNew) {
      showToast(`"${trimmed}" ${t('settingsCategories.toast.addedSuffix')}`)
    } else {
      showToast(t('settingsCategories.toast.updated'))
    }

    setSaving(false)
    onSaved?.(trimmed)
    onClose()
  }

  // Eliminar categoría personalizada (v0.9.627: vive aquí, antes era un
  // ícono junto al lápiz en la lista) — las 11 fijas nunca lo muestran.
  // Los pagos que ya tenían esta categoría se reasignan a "Otros".
  async function handleDelete() {
    const cat = editingCat.name
    setDeleting(true)
    const newCustom = customCats.filter(c => c !== cat)
    const newIcons  = { ...categoryIcons };  delete newIcons[cat]
    const newColors = { ...categoryColors }; delete newColors[cat]
    await onUpdate({ custom_categories: newCustom, category_icons: newIcons, category_colors: newColors })
    await supabase.from('payments').update({ category: 'Otros' }).eq('user_id', profile.id).eq('category', cat)
    showToast(`${t('settingsCategories.toast.deletedPrefix')} "${cat}" ${t('settingsCategories.toast.deletedSuffix')}`)
    setDeleting(false)
    onClose()
  }

  // Al pedir borrar, cuenta los pagos que quedarían reasignados (sin contar
  // maestros de recurrentes: son plantilla) para decirlo en la confirmación.
  async function askDelete() {
    setConfirmingDelete(true); setDeleteCount(null)
    const { count } = await supabase.from('payments').select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id).eq('category', editingCat.name).or('is_master.is.null,is_master.eq.false')
    setDeleteCount(count ?? 0)
  }

  const search = iconSearch.trim().toLowerCase()
  const filteredGroups = CATEGORY_ICON_GROUPS
    .map(g => ({ ...g, icons: search ? g.icons.filter(i => i.label.toLowerCase().includes(search)) : g.icons }))
    .filter(g => g.icons.length > 0)

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} className={styles.overlay} style={zIndex ? { zIndex } : undefined} data-presence="overlay" data-closing={closing ? '' : undefined}>
      <div className={styles.modalPanel} data-presence="panel" data-closing={closing ? '' : undefined}>
        <div className={styles.handle} />
        <div className={styles.modalTitle}>
          {editingCat ? t('settingsCategories.addModalTitleEdit') : t('settingsCategories.addModalTitleNew')}
        </div>

        {/* Nombre */}
        <div className={styles.fieldGroup}>
          <label className="field-label">{t('settingsCategories.nameLabel')}</label>
          {editingCat && !editingCat.isCustom ? (
            <>
              <div className={`field-input ${styles.readonlyField}`}>{getCategoryLabel(formName)}</div>
              <div className={styles.helperText}>{t('settingsCategories.nameReadonlyHelper')}</div>
            </>
          ) : (
            <input
              autoFocus
              className={`field-input ${styles.inputMt4}`}
              value={formName}
              onChange={e => { setFormName(e.target.value); setNameError('') }}
              placeholder={t('settingsCategories.namePlaceholder')}
            />
          )}
          {nameError && <div className={styles.errorText}>{nameError}</div>}
        </div>

        {/* Ícono */}
        <div className={styles.fieldGroup}>
          <label className={`field-label ${styles.label}`}>{t('settingsCategories.iconLabel')}</label>
          <div className={styles.searchWrapper}>
            <div className={styles.searchIcon}>
              <Search size={14} color="var(--text)" />
            </div>
            <input
              value={iconSearch}
              onChange={e => setIconSearch(e.target.value)}
              placeholder={t('settingsCategories.iconSearchPlaceholder')}
              className={`field-input ${styles.searchInput}`}
            />
          </div>

          <div className={styles.iconGroupsContainer}>
            {filteredGroups.map(group => (
              <div key={group.label} className={styles.iconGroup}>
                <div className={styles.iconGroupLabel}>{group.label}</div>
                <div className={styles.iconGrid}>
                  {group.icons.map(({ name, label }) => {
                    const Icon = getIconComponent(name)
                    const selected = formIcon === name
                    return (
                      <button
                        key={name}
                        type="button"
                        title={label}
                        onClick={() => setFormIcon(name)}
                        className={`${styles.iconButton} ${selected ? styles.iconButtonSelected : ''}`}
                      >
                        <Icon size={16} color={selected ? 'var(--surface)' : 'var(--text)'} />
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {filteredGroups.length === 0 && (
              <div className={styles.noResultsText}>{t('settingsCategories.noIconResults', { search: iconSearch })}</div>
            )}
          </div>
        </div>

        {/* Color */}
        <div className={styles.colorFieldGroup}>
          <label className={`field-label ${styles.label}`}>{t('settingsCategories.colorLabel')}</label>
          <div className={styles.colorGrid}>
            {CATEGORY_PALETTE.map(color => {
              const selected = formColor === color
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormColor(color)}
                  className={`${styles.colorSwatch} ${selected ? styles.colorSwatchSelected : ''}`}
                  style={{ background: color }}
                >
                  {selected && <Check size={13} color="var(--surface)" strokeWidth={3} />}
                </button>
              )
            })}
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} className={`btn-primary ${styles.saveButton}`}>
          {saving ? t('settingsCategories.saving') : t('buttons.save')}
        </button>
        <button onClick={onClose} className="btn-ghost">{t('buttons.cancel')}</button>

        {editingCat?.isCustom && (confirmingDelete ? (
          <div className={styles.deleteConfirmBox}>
            <div className={styles.confirmText}>
              {deleteCount === null
                ? t('settingsCategories.deleteChecking')
                : deleteCount === 0
                  ? t('settingsCategories.deleteConfirmNone', { name: editingCat.name })
                  : t('settingsCategories.deleteConfirmCount', { name: editingCat.name, count: deleteCount })}
            </div>
            <div className={styles.confirmButtonsRow}>
              <button onClick={() => setConfirmingDelete(false)} className={styles.confirmCancelButton}>{t('buttons.cancel')}</button>
              <button onClick={handleDelete} disabled={deleting || deleteCount === null} className={styles.confirmDeleteButton}>
                {deleting ? t('settingsCategories.deleting') : t('buttons.delete')}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={askDelete} className={styles.deleteCategoryButton}>
            {t('settingsCategories.deleteCategory')}
          </button>
        ))}
      </div>
    </div>
  )
}
