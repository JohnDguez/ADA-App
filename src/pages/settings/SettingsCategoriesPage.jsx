import { useState, useEffect } from 'react'
import { ChevronLeft, Plus, Check } from 'lucide-react'
import { CATEGORIES, getCatColor } from '../../lib/utils'
import { CATEGORY_ICON_OPTIONS, getCategoryIcon } from '../../lib/categoryIcons'
import { showToast } from '../../components/Toast'
import { Card } from '../../components/SettingsShared'

// Sub-página "Categorías" dentro de Ajustes — fase 2: selector de ícono
// Lucide por categoría (guardado en profile.category_icons, jsonb) + poder
// agregar una categoría personalizada nueva directo desde aquí (antes solo
// se podía desde PaymentModal al crear un pago).
export function SettingsCategoriesPage({ profile, onUpdate, onBack, slideClass }) {
  const [pickerCat,    setPickerCat]    = useState(null)
  const [adding,       setAdding]       = useState(false)
  const [newCatName,   setNewCatName]   = useState('')
  const [addError,     setAddError]     = useState('')

  const customCats = profile.custom_categories || []
  const categoryIcons = profile.category_icons || {}

  useEffect(() => {
    if (pickerCat) document.body.classList.add('modal-open')
    else            document.body.classList.remove('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [pickerCat])

  async function handlePickIcon(iconName) {
    await onUpdate({ category_icons: { ...categoryIcons, [pickerCat]: iconName } })
    setPickerCat(null)
  }

  async function handleAddCategory() {
    const trimmed = newCatName.trim()
    if (!trimmed) { setAddError('Escribe un nombre'); return }
    const allExisting = [...CATEGORIES, ...customCats]
    if (allExisting.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setAddError('Ya existe una categoría con ese nombre'); return
    }
    await onUpdate({ custom_categories: [...customCats, trimmed] })
    showToast(`Categoría "${trimmed}" agregada`)
    setNewCatName(''); setAddError(''); setAdding(false)
  }

  function CategoryRow({ cat, isCustom, last }) {
    const Icon = getCategoryIcon(cat, categoryIcons)
    return (
      <div onClick={() => setPickerCat(cat)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderBottom: last ? 'none' : '0.5px solid var(--border)', cursor: 'pointer' }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {Icon
            ? <Icon size={16} color={getCatColor(cat, customCats)} />
            : <div style={{ width: 12, height: 12, borderRadius: '50%', background: getCatColor(cat, customCats) }} />
          }
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1 }}>{cat}</span>
      </div>
    )
  }

  return (
    <>
      <div className={slideClass} style={{ paddingBottom: 120, background: 'var(--bg)', minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '52px 16px 20px' }}>
          <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <ChevronLeft size={18} color="var(--text)" />
          </button>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Categorías</div>
        </div>

        <Card>
          {CATEGORIES.map((cat, i) => (
            <CategoryRow key={cat} cat={cat} last={i === CATEGORIES.length - 1 && customCats.length === 0} />
          ))}
          {customCats.map((cat, i) => (
            <CategoryRow key={cat} cat={cat} isCustom last={i === customCats.length - 1} />
          ))}
        </Card>

        <Card>
          {!adding ? (
            <button onClick={() => { setAdding(true); setNewCatName(''); setAddError('') }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer' }}>
              <Plus size={16} color="var(--accent)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>Agregar categoría</span>
            </button>
          ) : (
            <div style={{ padding: '13px 14px' }}>
              <label className="field-label">Nombre de la categoría</label>
              <input
                autoFocus
                className="field-input"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                placeholder="ej. Gimnasio"
                style={{ marginTop: 4, marginBottom: addError ? 6 : 10 }}
              />
              {addError && <div style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 10 }}>{addError}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleAddCategory} className="btn-primary" style={{ flex: 1 }}>Guardar</button>
                <button onClick={() => setAdding(false)} className="btn-ghost" style={{ flex: 1 }}>Cancelar</button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {pickerCat && (
        <div onClick={e => e.target === e.currentTarget && setPickerCat(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(2,10,31,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, maxHeight: '75vh', overflowY: 'auto', padding: '20px 16px 32px', animation: 'modalSlideUp .3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both' }}>
            <div style={{ width: 34, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Elige un ícono</div>
            <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text)', marginBottom: 16 }}>Para "{pickerCat}"</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {CATEGORY_ICON_OPTIONS.map(name => {
                const Icon = getCategoryIcon(pickerCat, { [pickerCat]: name })
                const selected = categoryIcons[pickerCat] === name
                return (
                  <button key={name} onClick={() => handlePickIcon(name)}
                    style={{
                      position: 'relative', aspectRatio: '1', borderRadius: 'var(--radius-sm)',
                      border: 'none', background: selected ? 'var(--accent)' : 'var(--bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    }}>
                    <Icon size={20} color={selected ? 'var(--surface)' : 'var(--text)'} />
                    {selected && (
                      <div style={{ position: 'absolute', top: 3, right: 3, width: 14, height: 14, borderRadius: '50%', background: 'var(--paid)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={9} color="#fff" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            <button onClick={() => setPickerCat(null)} className="btn-ghost" style={{ marginTop: 16 }}>Cerrar</button>
          </div>
        </div>
      )}
    </>
  )
}
