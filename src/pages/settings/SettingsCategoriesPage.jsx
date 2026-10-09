import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import { Plus, ChevronRight } from 'lucide-react'
// Ícono del encabezado vía Phosphor Icons (mismo patrón que Exportar/Cuenta,
// v0.9.442-446) — import directo al archivo del ícono para tree-shaking real.
import { Tag } from '@phosphor-icons/react/dist/csr/Tag'
import { PageHero } from '../../components/PageHero'
import { CATEGORIES, getCatColor, getCategoryLabel } from '../../lib/utils'
import { getCategoryIcon } from '../../lib/categoryIcons'
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

  function CategoryRow({ cat, isCustom, last }) {
    const Icon  = getCategoryIcon(cat, categoryIcons)
    const color = getCatColor(cat, customCats, categoryColors)
    const noBorder = last

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
          </div>
          <ChevronRight size={14} color="var(--text)" />
        </div>
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
