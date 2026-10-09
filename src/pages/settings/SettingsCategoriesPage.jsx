import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import { Plus, Trash2, Pencil } from 'lucide-react'
// Ícono del encabezado vía Phosphor Icons (mismo patrón que Exportar/Cuenta,
// v0.9.442-446) — import directo al archivo del ícono para tree-shaking real.
import { Tag } from '@phosphor-icons/react/dist/csr/Tag'
import { PageHero } from '../../components/PageHero'
import { CATEGORIES, getCatColor, getCategoryLabel } from '../../lib/utils'
import { getCategoryIcon } from '../../lib/categoryIcons'
import { showToast } from '../../components/Toast'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/SettingsShared'
import { CategoryFormModal } from '../../components/CategoryFormModal'
import styles from './SettingsCategoriesPage.module.css'

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
  const [confirmDeleteCat, setConfirmDeleteCat] = useState(null) // nombre de la categoría personalizada a confirmar, o null
  const [deleting,    setDeleting]    = useState(false)

  // Pagos por categoría (v0.9.626) — mismo alcance que renombrar/borrar
  // (todos los pagos del usuario con ese nombre), sin contar los maestros
  // de recurrentes (son plantilla, no un pago real). Se pagina de 1000 en
  // 1000 por el límite de filas de Supabase. Se recarga al cerrar el modal
  // (renombrar) y al terminar de borrar.
  const [counts, setCounts] = useState(null)
  useEffect(() => {
    if (modalOpen || deleting) return
    let alive = true
    ;(async () => {
      const tally = {}
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('payments').select('category')
          .eq('user_id', profile.id).or('is_master.is.null,is_master.eq.false')
          .range(from, from + 999)
        if (error) return
        for (const r of data) tally[r.category] = (tally[r.category] || 0) + 1
        if (data.length < 1000) break
      }
      if (alive) setCounts(tally)
    })()
    return () => { alive = false }
  }, [profile.id, modalOpen, deleting])

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
    setModalOpen(true)
  }

  function openAdd() {
    setEditingCat(null)
    setModalOpen(true)
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
          <div className={styles.categoryText}>
            <span className={styles.categoryLabel}>{isCustom ? cat : getCategoryLabel(cat)}</span>
            {counts && (
              <span className={styles.categoryCount}>
                {counts[cat] ? t('settingsCategories.paymentsCount', { count: counts[cat] }) : t('settingsCategories.noPayments')}
              </span>
            )}
          </div>
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
          <Plus size={18} color="var(--surface)" />
          {t('settingsCategories.addButton')}
        </button>
      </div>

      <CategoryFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingCat={editingCat}
        profile={profile}
        onUpdate={onUpdate}
      />
    </>
  )
}
