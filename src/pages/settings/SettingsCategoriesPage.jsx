import { useState } from 'react'
import { ChevronLeft, Plus, Check, Search, Trash2 } from 'lucide-react'
import { CATEGORIES, getCatColor } from '../../lib/utils'
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
export function SettingsCategoriesPage({ profile, onUpdate, onBack, slideClass }) {
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
  // hacía más lento encontrar una categoría específica. localeCompare con
  // locale 'es' para que acentos/ñ ordenen de forma natural.
  const sortedCats = [
    ...CATEGORIES.map(cat => ({ name: cat, isCustom: false })),
    ...customCats.map(cat => ({ name: cat, isCustom: true })),
  ].sort((a, b) => a.name.localeCompare(b.name, 'es'))

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
    if (!trimmed) { setNameError('Escribe un nombre'); return }

    const oldName  = editingCat?.name
    const isNew    = !editingCat
    const isRename = editingCat?.isCustom && trimmed !== oldName

    const others = [...CATEGORIES, ...customCats].filter(c => c !== oldName)
    if (others.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setNameError('Ya existe una categoría con ese nombre'); return
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
      showToast(`Categoría renombrada a "${trimmed}"`)
    } else if (isNew) {
      showToast(`Categoría "${trimmed}" agregada`)
    } else {
      showToast('Categoría actualizada')
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

    showToast(`Categoría "${cat}" eliminada`)
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
          <span className={styles.categoryLabel}>{cat}</span>
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
              ¿Eliminar "{cat}"? Los pagos ya registrados con esta categoría se reasignarán a "Otros".
            </div>
            <div className={styles.confirmButtonsRow}>
              <button onClick={() => setConfirmDeleteCat(null)} className={styles.confirmCancelButton}>
                Cancelar
              </button>
              <button onClick={() => handleDeleteCategory(cat)} disabled={deleting} className={styles.confirmDeleteButton}>
                {deleting ? 'Eliminando…' : 'Eliminar'}
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
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <button onClick={onBack} className={styles.backButton}>
              <ChevronLeft size={18} color="var(--text)" />
            </button>
            <div className={styles.headerTitle}>Categorías</div>
          </div>
          <button onClick={openAdd} className={styles.addButton}>
            <Plus size={18} color="var(--surface)" />
          </button>
        </div>

        <Card>
          {sortedCats.map((c, i) => (
            <CategoryRow key={c.name} cat={c.name} isCustom={c.isCustom} last={i === sortedCats.length - 1} />
          ))}
        </Card>
      </div>

      {modalOpen && (
        <div onClick={e => e.target === e.currentTarget && setModalOpen(false)} className={styles.overlay}>
          <div className={styles.modalPanel}>
            <div className={styles.handle} />
            <div className={styles.modalTitle}>
              {editingCat ? 'Editar categoría' : 'Agregar categoría'}
            </div>

            {/* Nombre */}
            <div className={styles.fieldGroup}>
              <label className="field-label">Nombre</label>
              {editingCat && !editingCat.isCustom ? (
                <>
                  <div className={`field-input ${styles.readonlyField}`}>{formName}</div>
                  <div className={styles.helperText}>
                    Las categorías por defecto no se pueden renombrar, para no afectar pagos ya registrados.
                  </div>
                </>
              ) : (
                <input
                  autoFocus
                  className={`field-input ${styles.inputMt4}`}
                  value={formName}
                  onChange={e => { setFormName(e.target.value); setNameError('') }}
                  placeholder="ej. Gimnasio"
                />
              )}
              {nameError && <div className={styles.errorText}>{nameError}</div>}
            </div>

            {/* Ícono */}
            <div className={styles.fieldGroup}>
              <label className={`field-label ${styles.label}`}>Ícono</label>
              <div className={styles.searchWrapper}>
                <div className={styles.searchIcon}>
                  <Search size={14} color="var(--text)" />
                </div>
                <input
                  value={iconSearch}
                  onChange={e => setIconSearch(e.target.value)}
                  placeholder="Buscar ícono…"
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
                  <div className={styles.noResultsText}>Sin resultados para "{iconSearch}"</div>
                )}
              </div>
            </div>

            {/* Color */}
            <div className={styles.colorFieldGroup}>
              <label className={`field-label ${styles.label}`}>Color</label>
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
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setModalOpen(false)} className="btn-ghost">Cancelar</button>
          </div>
        </div>
      )}
    </>
  )
}
