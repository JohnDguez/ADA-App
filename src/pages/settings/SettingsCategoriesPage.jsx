import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import { Plus, Check, Search, Trash2, Pencil } from 'lucide-react'
// Ícono del encabezado vía Phosphor Icons (mismo patrón que Exportar/Cuenta,
// v0.9.442-446) — import directo al archivo del ícono para tree-shaking real.
import { Tag } from '@phosphor-icons/react/dist/csr/Tag'
import { PageHero } from '../../components/PageHero'
import { CATEGORIES, getCatColor, getCategoryLabel } from '../../lib/utils'
import { CATEGORY_ICON_GROUPS, getCategoryIcon, getIconComponent } from '../../lib/categoryIcons'
import { showToast } from '../../components/Toast'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/SettingsShared'
import styles from './SettingsCategoriesPage.module.css'

const PALETTE = Array.from({ length: 16 }, (_, i) => `var(--palette-${i + 1})`)

// Sub-página "Categorías" dentro de Ajustes — fase 3: modal completo
// (nombre + ícono + color) para agregar y editar cualquier categoría.
// Las 11 categorías fijas solo permiten cambiar ícono/color (el nombre es
// de solo lectura, para no desincronizar pagos ya registrados en pantallas
// que no viven en este archivo). Las personalizadas sí permiten renombrar,
// y ese cambio se propaga a los pagos existentes con ese nombre.
//
// NOTA i18n: los NOMBRES de las 11 categorías fijas (CATEGORIES, de
// lib/utils.js) y "Otros" NO se traducen — decisión ya tomada y cerrada
// con Johnatan (v0.9.150, "se quedan bloqueadas para siempre"): son el
// valor literal guardado en payments.category, usado para filtrar/hacer
// match en toda la app. Traducirlos requeriría desacoplar el nombre
// visible del valor guardado — cambio de arquitectura aparte, no de esta
// pasada de extracción de texto.
export function SettingsCategoriesPage({ profile, onUpdate, onBack, slideClass }) {
  const { t } = useTranslation()
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editingCat,  setEditingCat]  = useState(null) // { name, isCustom } | null (null = agregar nueva)
  const [formName,    setFormName]    = useState('')
  const [formIcon,    setFormIcon]    = useState('')
  const [formColor,   setFormColor]   = useState('')
  const [iconSearch,  setIconSearch]  = useState('')
  const [nameError,   setNameError]   = useState('')
  const [saving,      setSaving]      = useState(false)
  const [confirmDeleteCat, setConfirmDeleteCat] = useState(null) // nombre de la categoría personalizada a confirmar, o null
  const [deleting,    setDeleting]    = useState(false)

  const customCats     = profile.custom_categories || []
  const categoryIcons  = profile.category_icons || {}
  const categoryColors = profile.category_colors || {}

  // Listado combinado (fijas + personalizadas) en orden alfabético — antes
  // se dibujaban en 2 bloques separados (fijas primero, personalizadas
  // después) sin ningún encabezado visual que las distinguiera, lo que
  // hacía más lento encontrar una categoría específica. Ordena por el
  // NOMBRE MOSTRADO (traducido para las fijas, tal cual para las
  // personalizadas) — no por el valor guardado — para que en inglés no se
  // vea alfabetizado según el español. i18n.language en vez de 'es' fijo,
  // mismo motivo.
  const sortedCats = [
    ...CATEGORIES.map(cat => ({ name: cat, isCustom: false })),
    ...customCats.map(cat => ({ name: cat, isCustom: true })),
  ].sort((a, b) => {
    const labelA = a.isCustom ? a.name : getCategoryLabel(a.name)
    const labelB = b.isCustom ? b.name : getCategoryLabel(b.name)
    return labelA.localeCompare(labelB, i18n.language)
  })

  function openEdit(cat, isCustom) {
    setEditingCat({ name: cat, isCustom })
    setFormName(cat)
    setFormIcon(categoryIcons[cat] || '')
    setFormColor(getCatColor(cat, customCats, categoryColors))
    setIconSearch(''); setNameError('')
    setModalOpen(true)
  }

  function openAdd() {
    setEditingCat(null)
    setFormName(''); setFormIcon(''); setFormColor(PALETTE[0])
    setIconSearch(''); setNameError('')
    setModalOpen(true)
  }

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
    setModalOpen(false)
  }

  // Eliminar categoría personalizada — las 11 fijas nunca pasan por aquí
  // (el botón de borrar solo se dibuja para isCustom). Los pagos que ya
  // tenían esta categoría se reasignan a "Otros" en vez de quedar huérfanos
  // o bloquear el borrado (decisión de Johnatan).
  async function handleDeleteCategory(cat) {
    setDeleting(true)

    const newCustom = customCats.filter(c => c !== cat)
    const newIcons  = { ...categoryIcons };  delete newIcons[cat]
    const newColors = { ...categoryColors }; delete newColors[cat]

    await onUpdate({ custom_categories: newCustom, category_icons: newIcons, category_colors: newColors })
    await supabase.from('payments').update({ category: 'Otros' }).eq('user_id', profile.id).eq('category', cat)

    showToast(`${t('settingsCategories.toast.deletedPrefix')} "${cat}" ${t('settingsCategories.toast.deletedSuffix')}`)
    setConfirmDeleteCat(null)
    setDeleting(false)
  }

  function CategoryRow({ cat, isCustom, last }) {
    const Icon  = getCategoryIcon(cat, categoryIcons)
    const color = getCatColor(cat, customCats, categoryColors)
    const isConfirming = confirmDeleteCat === cat
    const noBorder = last && !isConfirming

    return (
      <div>
        <div
          onClick={() => openEdit(cat, isCustom)}
          className={`${styles.categoryRow} ${noBorder ? styles.categoryRowNoBorder : ''}`}
        >
          <div className={styles.iconWrapper} style={{ background: color }}>
            {Icon
              ? <Icon size={18} color="var(--text)" strokeWidth={2} />
              : <span className={styles.fallbackDot} />
            }
          </div>
          <span className={styles.categoryLabel}>{isCustom ? cat : getCategoryLabel(cat)}</span>
          <Pencil size={16} color="var(--text)" className={styles.editIcon} />
          {isCustom && (
            <button
              onClick={e => { e.stopPropagation(); setConfirmDeleteCat(prev => prev === cat ? null : cat) }}
              className={styles.deleteIconButton}
            >
              <Trash2 size={16} color="var(--text)" />
            </button>
          )}
        </div>

        {isConfirming && (
          <div className={`${styles.confirmPanel} ${last ? styles.confirmPanelNoBorder : ''}`}>
            <div className={styles.confirmText}>
              {t('settingsCategories.deleteConfirmPrefix')} "{cat}"{t('settingsCategories.deleteConfirmSuffix')}
            </div>
            <div className={styles.confirmButtonsRow}>
              <button onClick={() => setConfirmDeleteCat(null)} className={styles.confirmCancelButton}>
                {t('buttons.cancel')}
              </button>
              <button onClick={() => handleDeleteCategory(cat)} disabled={deleting} className={styles.confirmDeleteButton}>
                {deleting ? t('settingsCategories.deleting') : t('buttons.delete')}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const search = iconSearch.trim().toLowerCase()
  const filteredGroups = CATEGORY_ICON_GROUPS
    .map(g => ({ ...g, icons: search ? g.icons.filter(i => i.label.toLowerCase().includes(search)) : g.icons }))
    .filter(g => g.icons.length > 0)

  return (
    <>
      <div className={`${slideClass} ${styles.pageWrapper}`}>
        <PageHero
          icon={Tag}
          title={t('settingsCategories.title')}
          description={t('settingsCategories.description')}
          onBack={onBack}
        />

        <Card>
          {sortedCats.map((c, i) => (
            <CategoryRow key={c.name} cat={c.name} isCustom={c.isCustom} last={i === sortedCats.length - 1} />
          ))}
        </Card>
      </div>

      {/* Pastilla flotante "Agregar categoría" — mismo patrón ya aprobado
          en GoalsPage.jsx ("Añadir meta"), pedido explícito de Johnatan:
          el botón + vivía solo en el encabezado, obligando a hacer scroll
          hasta arriba para agregar una categoría nueva si la lista es
          larga. EXCEPCIÓN DOCUMENTADA a la Regla 13 (radius 5px / pills
          solo en segmentados de 2 posiciones) — ver RULES.md, ya aprobada
          para este mismo tipo de botón en Metas. */}
      <div className={styles.addPillRow}>
        <button type="button" onClick={openAdd} className={styles.addPill}>
          <Plus size={18} color="#fff" />
          {t('settingsCategories.addButton')}
        </button>
      </div>

      {modalOpen && (
        <div onClick={e => e.target === e.currentTarget && setModalOpen(false)} className={styles.overlay}>
          <div className={styles.modalPanel}>
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
                  <div className={styles.helperText}>
                    {t('settingsCategories.nameReadonlyHelper')}
                  </div>
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
                    <div className={styles.iconGroupLabel}>
                      {group.label}
                    </div>
                    <div className={styles.iconGrid}>
                      {group.icons.map(({ name, label }) => {
                        const Icon = getIconComponent(name)
                        const selected = formIcon === name
                        return (
                          <button
                            key={name}
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
                {PALETTE.map(color => {
                  const selected = formColor === color
                  return (
                    <button
                      key={color}
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
            <button onClick={() => setModalOpen(false)} className="btn-ghost">{t('buttons.cancel')}</button>
          </div>
        </div>
      )}
    </>
  )
}
