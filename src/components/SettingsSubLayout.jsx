import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { useDeskSettings } from './DeskSettingsContext'
import { DeskSettingsHead, DeskPage } from './DeskSettingsHead'
import { useIsMobile } from '../hooks/useIsMobile'
import home from '../pages/DeskHome.module.css'
import tb from '../pages/settings/SettingsCobroTab.module.css'
import sp from '../pages/settings/SettingsSharedSpaceTab.module.css'
import root from '../pages/settings/SettingsSharedSpacePage.module.css'
import kit from './SettingsKit.module.css'

// Modo de una sub-página de Ajustes: 'desk' (panel derecho de escritorio o
// tablet horizontal), 'tablet' (pantalla completa ≥768) o 'mobile'.
export function useSettingsMode() {
  const desk = useDeskSettings()
  const isMobile = useIsMobile()
  return desk ? 'desk' : isMobile ? 'mobile' : 'tablet'
}

// Envoltura común de las sub-páginas de Ajustes rediseñadas (v0.9.977,
// DISENO.md §6 «Encabezado de sub-página»). El contenido es el mismo en los
// tres tamaños; aquí solo cambia el encabezado:
//   móvil  → botón atrás 40 px + ficha 36 px + título 21/700 + descripción
//   tablet → botón atrás + descripción + título grande (como Espacio compartido)
//   escritorio → DeskPage gris + DeskSettingsHead (26 px + descripción)
// `data-sk` deja que SettingsKit.module.css ajuste las piezas por tamaño.
export function SettingsSubLayout({ title, description, icon: Icon, onBack, slideClass = '', actions, children, after }) {
  const { t } = useTranslation()
  const mode = useSettingsMode()

  if (mode === 'desk') {
    return (
      <DeskPage gray>
        <DeskSettingsHead title={title} description={description} actions={actions} />
        <div data-sk="desk" className={kit.body}>{children}</div>
        {after}
      </DeskPage>
    )
  }

  if (mode === 'tablet') {
    return (
      <>
        <div className={`${slideClass} ${home.root} ${home.tablet}`}>
          <header className={`${home.head} ${tb.headBar}`}>
            <div className={`${home.headText} ${tb.headRow}`}>
              <button type="button" className={tb.back} onClick={onBack} aria-label={t('buttons.back')}><ChevronLeft size={20} /></button>
              <div>
                <div className={home.date}>{description}</div>
                <h1 className={home.hello}>{title}</h1>
              </div>
            </div>
            {actions && <div className={kit.tabActions}>{actions}</div>}
          </header>
          <div data-sk="tablet" className={`${kit.body} ${kit.tabletBody}`}>{children}</div>
        </div>
        {after}
      </>
    )
  }

  return (
    <>
      <div className={`${slideClass} ${root.pageRoot}`}>
        <div className={sp.mHead}>
          <button type="button" className={sp.mBack} onClick={onBack} aria-label={t('buttons.back')}><ChevronLeft size={20} /></button>
          {Icon && <span className={sp.mIco}><Icon size={20} /></span>}
          <h1 className={sp.mTitle}>{title}</h1>
          {actions && <div className={kit.mActions}>{actions}</div>}
        </div>
        <p className={sp.mDesc}>{description}</p>
        <div data-sk="mobile" className={`${kit.body} ${kit.mobileBody}`}>{children}</div>
      </div>
      {after}
    </>
  )
}

// Segmentado con píldora deslizante (activo = --desk-pill, DISENO.md §6).
export function SkSeg({ options, value, onChange, className = '' }) {
  const i = Math.max(0, options.findIndex(o => o.value === value))
  const n = options.length
  return (
    <div className={`${kit.seg} ${className}`} role="tablist">
      <span className={kit.segPill} style={{ width: `calc((100% - 8px) / ${n})`, transform: `translateX(${i * 100}%)` }} />
      {options.map(o => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value}
          className={o.value === value ? kit.segOn : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
