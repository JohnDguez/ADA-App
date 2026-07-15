import { useState } from 'react'
import { ChevronLeft, Plus, Check, Search, Trash2 } from 'lucide-react'
import { CATEGORIES, getCatColor } from '../../lib/utils'
import { CATEGORY_ICON_GROUPS, getCategoryIcon, getIconComponent } from '../../lib/categoryIcons'
import { showToast } from '../../components/Toast'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/SettingsShared'

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

    return (
      <div>
        <div onClick={() => openEdit(cat, isCustom)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderBottom: (last && !isConfirming) ? 'none' : '0.5px solid var(--border)', cursor: 'pointer' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {Icon
              ? <Icon size={18} color="var(--text)" strokeWidth={2} />
              : <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text)' }} />
            }
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1 }}>{cat}</span>
          {isCustom && (
            <button
              onClick={e => { e.stopPropagation(); setConfirmDeleteCat(prev => prev === cat ? null : cat) }}
              style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
              <Trash2 size={16} color="var(--text)" />
            </button>
          )}
        </div>

        {isConfirming && (
          <div style={{ padding: '10px 14px', background: 'var(--danger-soft)', borderBottom: last ? 'none' : '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', marginBottom: 8 }}>
              ¿Eliminar "{cat}"? Los pagos ya registrados con esta categoría se reasignarán a "Otros".
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmDeleteCat(null)} style={{ flex: 1, padding: '7px', borderRadius: 6, border: '0.5px solid var(--border)', background: 'var(--surface)', fontSize: 12, fontWeight: 600, color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                Cancelar
              </button>
              <button onClick={() => handleDeleteCategory(cat)} disabled={deleting} style={{ flex: 1, padding: '7px', borderRadius: 6, border: 'none', background: 'var(--danger)', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
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
      <div className={slideClass} style={{ paddingBottom: 120, background: 'var(--bg)', minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '52px 16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <ChevronLeft size={18} color="var(--text)" />
            </button>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Categorías</div>
          </div>
          <button onClick={openAdd} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <Plus size={18} color="var(--surface)" />
          </button>
        </div>

        <Card>
          {CATEGORIES.map((cat, i) => (
            <CategoryRow key={cat} cat={cat} isCustom={false} last={i === CATEGORIES.length - 1 && customCats.length === 0} />
          ))}
          {customCats.map((cat, i) => (
            <CategoryRow key={cat} cat={cat} isCustom last={i === customCats.length - 1} />
          ))}
        </Card>
      </div>

      {modalOpen && (
        <div onClick={e => e.target === e.currentTarget && setModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(2,10,31,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, maxHeight: '88vh', overflowY: 'auto', padding: '20px 16px 32px', animation: 'modalSlideUp .3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both' }}>
            <div style={{ width: 34, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
              {editingCat ? 'Editar categoría' : 'Agregar categoría'}
            </div>

            {/* Nombre */}
            <div style={{ marginBottom: 18 }}>
              <label className="field-label">Nombre</label>
              {editingCat && !editingCat.isCustom ? (
                <>
                  <div className="field-input" style={{ opacity: 0.6, marginTop: 4 }}>{formName}</div>
                  <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)', marginTop: 4 }}>
                    Las categorías por defecto no se pueden renombrar, para no afectar pagos ya registrados.
                  </div>
                </>
              ) : (
                <input
                  autoFocus
                  className="field-input"
                  value={formName}
                  onChange={e => { setFormName(e.target.value); setNameError('') }}
                  placeholder="ej. Gimnasio"
                  style={{ marginTop: 4 }}
                />
              )}
              {nameError && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{nameError}</div>}
            </div>

            {/* Ícono */}
            <div style={{ marginBottom: 18 }}>
              <label className="field-label" style={{ marginBottom: 6, display: 'block' }}>Ícono</label>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
                  <Search size={14} color="var(--text)" />
                </div>
                <input
                  value={iconSearch}
                  onChange={e => setIconSearch(e.target.value)}
                  placeholder="Buscar ícono…"
                  className="field-input"
                  style={{ paddingLeft: 34 }}
                />
              </div>

              <div style={{ maxHeight: 240, overflowY: 'auto', paddingRight: 2 }}>
                {filteredGroups.map(group => (
                  <div key={group.label} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      {group.label}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                      {group.icons.map(({ name, label }) => {
                        const Icon = getIconComponent(name)
                        const selected = formIcon === name
                        return (
                          <button key={name} title={label} onClick={() => setFormIcon(name)}
                            style={{ position: 'relative', aspectRatio: '1', borderRadius: 'var(--radius-sm)', border: 'none', background: selected ? 'var(--accent)' : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <Icon size={16} color={selected ? 'var(--surface)' : 'var(--text)'} />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {filteredGroups.length === 0 && (
                  <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text)', padding: '8px 0' }}>Sin resultados para "{iconSearch}"</div>
                )}
              </div>
            </div>

            {/* Color */}
            <div style={{ marginBottom: 20 }}>
              <label className="field-label" style={{ marginBottom: 6, display: 'block' }}>Color</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8 }}>
                {PALETTE.map(color => {
                  const selected = formColor === color
                  return (
                    <button key={color} onClick={() => setFormColor(color)}
                      style={{ position: 'relative', aspectRatio: '1', borderRadius: '50%', border: selected ? '2px solid var(--text)' : 'none', background: color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {selected && <Check size={13} color="#fff" strokeWidth={3} />}
                    </button>
                  )
                })}
              </div>
            </div>

            <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ marginBottom: 8 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setModalOpen(false)} className="btn-ghost">Cancelar</button>
          </div>
        </div>
      )}
    </>
  )
}
