import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import { Plus, Search, Pointer, ChevronLeft } from 'lucide-react'
// Ícono del encabezado vía Phosphor Icons (mismo patrón que Exportar/Cuenta,
// v0.9.442-446) — import directo al archivo del ícono para tree-shaking real.
import { Tag } from '@phosphor-icons/react/dist/csr/Tag'
import { CATEGORIES, getCatColor, getCategoryLabel } from '../../lib/utils'
import { catInk } from '../../lib/colorUtils'
import { getCategoryIcon } from '../../lib/categoryIcons'
import { CategoryFormModal } from '../../components/CategoryFormModal'
import { useDeskSettings } from '../../components/DeskSettingsContext'
import { DeskSettingsHead, DeskPage } from '../../components/DeskSettingsHead'
import deskStyles from '../../components/SettingsDesk.module.css'
import dk from './SettingsCategoriesDesk.module.css'
import wd from './SettingsCategoriesWide.module.css'
import home from '../DeskHome.module.css'
import tb from './SettingsCobroTab.module.css'
import styles from './SettingsCategoriesPage.module.css'
import mb from './SettingsCategoriesMobile.module.css'
import { SubpageHeader } from '../../components/SubpageHeader'
import { useIsMobile } from '../../hooks/useIsMobile'

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
  const desk = useDeskSettings()
  const isMobile = useIsMobile()
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editingCat,  setEditingCat]  = useState(null) // { name, isCustom } | null (null = agregar nueva)
  const [query,        setQuery]       = useState('')

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

  if (desk && modalOpen) {
    return <CategoryFormModal inline open onClose={() => setModalOpen(false)} editingCat={editingCat} profile={profile} onUpdate={onUpdate} />
  }

  // Tablet y escritorio (v0.9.952): mosaicos con el estilo del móvil. Vertical (sin
  // panel) = página completa con píldora flotante; horizontal/escritorio = dentro
  // del panel de Ajustes con buscador y «Nueva categoría» en el encabezado.
  if (desk || !isMobile) {
    const q = query.trim().toLowerCase()
    const labelOf = c => (c.isCustom ? c.name : getCategoryLabel(c.name))
    const shown = sortedCats.filter(c => !q || labelOf(c).toLowerCase().includes(q))
    const defaults = shown.filter(c => !c.isCustom)
    const mine = shown.filter(c => c.isCustom)
    let n = 0
    const renderTile = c => {
      const Icon = getCategoryIcon(c.name, categoryIcons)
      const color = getCatColor(c.name, customCats, categoryColors)
      return (
        <button key={c.name} type="button" className={wd.tile} style={{ '--n': Math.min(n++, 14) }} onClick={() => openEdit(c.name, c.isCustom)}>
          <i className={wd.ico} style={{ background: color }}>{Icon ? <Icon size={25} color={catInk(color)} strokeWidth={2} /> : <span className={styles.fallbackDot} />}</i>
          <span>{labelOf(c)}</span>
        </button>
      )
    }
    const newTile = () => (
      <button type="button" className={`${wd.tile} ${wd.add}`} style={{ '--n': Math.min(n++, 14) }} onClick={openAdd}>
        <i className={wd.ico}><Plus size={25} strokeWidth={2.4} /></i>
        <span>{t('settingsCategories.deskNewShort')}</span>
      </button>
    )
    const sections = (gridCls) => (
      <>
        {shown.length === 0 && <div className={wd.empty}>{t('settingsCategories.deskNoResults')}</div>}
        {(mine.length > 0 || !q) && (
          <>
            <div className={`${wd.cap} ${wd.capFirst}`}>{t('settingsCategories.deskMine', { count: mine.length })}</div>
            <div className={`${wd.grid} ${gridCls}`}>{mine.map(renderTile)}{!q && newTile()}</div>
          </>
        )}
        {defaults.length > 0 && (
          <>
            <div className={wd.cap}>{t('settingsCategories.deskDefaults', { count: defaults.length })}</div>
            <div className={`${wd.grid} ${gridCls}`}>{defaults.map(renderTile)}</div>
          </>
        )}
      </>
    )
    if (desk) {
      return (
        <DeskPage>
          <DeskSettingsHead
            title={t('settingsCategories.title')}
            description={t('settingsCategories.description')}
            actions={<>
              <label className={dk.search}>
                <Search size={16} />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('settingsCategories.deskSearch')} aria-label={t('settingsCategories.deskSearch')} />
              </label>
              <button type="button" className={deskStyles.btn} onClick={openAdd}><Plus size={16} />{t('settingsCategories.deskNew')}</button>
            </>}
          />
          {sections('')}
        </DeskPage>
      )
    }
    return (
      <>
        <div className={`${slideClass} ${home.root} ${home.tablet}`}>
          <header className={`${home.head} ${tb.headBar}`}>
            <div className={`${home.headText} ${tb.headRow}`}>
              <button type="button" className={tb.back} onClick={onBack} aria-label={t('buttons.back')}><ChevronLeft size={20} /></button>
              <div>
                <div className={home.date}>{t('settingsCategories.description')}</div>
                <h1 className={home.hello}>{t('settingsCategories.title')}</h1>
              </div>
            </div>
          </header>
          <div className={wd.page}>
            <div className={wd.searchRow}>
              <label className={wd.searchPill}>
                <Search size={18} />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('settingsCategories.deskSearch')} aria-label={t('settingsCategories.deskSearch')} />
              </label>
              <span className={wd.hint}><Pointer size={15} strokeWidth={1.9} />{t('settingsCategories.mobile.tapHint')}</span>
            </div>
            {sections(wd.pageGrid)}
          </div>
        </div>
        <div className={wd.pillRow}>
          <button type="button" onClick={openAdd} className={wd.pill}>
            <Plus size={19} strokeWidth={2.4} />
            {t('settingsCategories.addButton')}
          </button>
        </div>
        <CategoryFormModal open={modalOpen} onClose={() => setModalOpen(false)} editingCat={editingCat} profile={profile} onUpdate={onUpdate} />
      </>
    )
  }

  // Móvil (<768px, v0.9.920, mockup "A · Mosaicos" aprobado): buscador, "Tuyas"
  // (con mosaico "Nueva") y "Predeterminadas" en cuadrícula de 3, nota de toque
  // y píldora flotante. El editor sigue siendo CategoryFormModal.
  if (isMobile && !desk) {
    const q = query.trim().toLowerCase()
    const labelOf = c => (c.isCustom ? c.name : getCategoryLabel(c.name))
    const shown = sortedCats.filter(c => !q || labelOf(c).toLowerCase().includes(q))
    const defaults = shown.filter(c => !c.isCustom)
    const mine = shown.filter(c => c.isCustom)
    let n = 0
    // Función (no componente): si fuera un componente definido aquí se remontaría
    // en cada tecla del buscador y la animación de entrada se repetiría.
    const renderTile = c => {
      const Icon = getCategoryIcon(c.name, categoryIcons)
      const color = getCatColor(c.name, customCats, categoryColors)
      return (
        <button key={c.name} type="button" className={mb.tile} style={{ '--n': Math.min(n++, 14) }} onClick={() => openEdit(c.name, c.isCustom)}>
          <i className={mb.ico} style={{ background: color }}>{Icon ? <Icon size={22} color={catInk(color)} strokeWidth={2} /> : <span className={styles.fallbackDot} />}</i>
          <span>{labelOf(c)}</span>
        </button>
      )
    }
    return (
      <>
        <div className={`${slideClass} ${mb.root}`}>
          <SubpageHeader icon={Tag} title={t('settingsCategories.title')} onBack={onBack} />
          <p className={mb.desc}>{t('settingsCategories.description')}</p>
          <label className={mb.search}>
            <Search size={16} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('settingsCategories.deskSearch')} aria-label={t('settingsCategories.deskSearch')} />
          </label>
          <p className={mb.hint}><Pointer size={14} strokeWidth={1.9} />{t('settingsCategories.mobile.tapHint')}</p>

          {shown.length === 0 && <div className={mb.empty}>{t('settingsCategories.mobile.noResults')}</div>}
          {(mine.length > 0 || !q) && (
            <>
              <div className={mb.cap}>{t('settingsCategories.deskMine', { count: mine.length })}</div>
              <div className={mb.grid}>
                {mine.map(renderTile)}
                {!q && (
                  <button type="button" className={`${mb.tile} ${mb.add}`} style={{ '--n': Math.min(n++, 14) }} onClick={openAdd}>
                    <i className={mb.ico}><Plus size={22} strokeWidth={2.4} /></i>
                    <span>{t('settingsCategories.deskNewShort')}</span>
                  </button>
                )}
              </div>
            </>
          )}
          {defaults.length > 0 && (
            <>
              <div className={mb.cap}>{t('settingsCategories.deskDefaults', { count: defaults.length })}</div>
              <div className={mb.grid}>{defaults.map(renderTile)}</div>
            </>
          )}
        </div>

        <div className={mb.pillRow}>
          <button type="button" onClick={openAdd} className={mb.pill}>
            <Plus size={18} strokeWidth={2.4} />
            {t('settingsCategories.addButton')}
          </button>
        </div>

        <CategoryFormModal open={modalOpen} onClose={() => setModalOpen(false)} editingCat={editingCat} profile={profile} onUpdate={onUpdate} />
      </>
    )
  }

  return null
}
