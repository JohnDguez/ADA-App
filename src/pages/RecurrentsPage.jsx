import { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Pause, Play, Trash2, Search, ChevronDown, CreditCard, Pencil, MoreVertical } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { NewSharedSpacePanel } from '../components/NewSharedSpacePanel'
import { RecurrentDetailPanel } from '../components/RecurrentDetailPanel'
import { fmt, RECUR_FREQ, getFrequencyLabel, dateOf, getMonthsShort, getCatColor, getCategoryLabel } from '../lib/utils'
import { getCategoryIcon } from '../lib/categoryIcons'
import { showToast } from '../components/Toast'
import { StatsCardSkeleton, CategoryAccordionSkeleton } from '../components/SkeletonLoader'
import styles from './RecurrentsPage.module.css'

function FilterChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} className={`${styles.filterChip} ${active ? styles.filterChipActive : ''}`}>
      {label}
    </button>
  )
}

export function RecurrentsPage({ payments, dataLoading = false, profile, spaceSwitcher, activeSpaceHeader, activeSpaceId = null, sharedSpaces, spacePermissions, onOpenPremium, onSpaceReady, unreadCount, onOpenNotifs, onGoSettings, onPause, onResume, onDelete, onEdit, onAdd, slideClass }) {
  const { t } = useTranslation()
  // Mismo mecanismo que HomePage.jsx — ver ahí el porqué (evitar que la
  // animación de entrada se dispare también en un simple cambio de
  // pestaña, no solo en un cambio real de espacio).
  const prevSpaceRef = useRef(activeSpaceId)
  const [spaceJustChanged, setSpaceJustChanged] = useState(false)
  useEffect(() => {
    if (prevSpaceRef.current !== activeSpaceId) {
      setSpaceJustChanged(true)
      prevSpaceRef.current = activeSpaceId
      const timer = setTimeout(() => setSpaceJustChanged(false), 300)
      return () => clearTimeout(timer)
    }
  }, [activeSpaceId])

  const [search,          setSearch]          = useState('')
  const [filterStatus,    setFilterStatus]    = useState('todos')
  const [filterType,      setFilterType]      = useState('todos')
  const [expandedCats,    setExpandedCats]    = useState({})
  const [confirmDelete,   setConfirmDelete]   = useState(null)
  const [openMenu,        setOpenMenu]        = useState(null)
  const [selectedMasterId, setSelectedMasterId] = useState(null)

  const canEdit   = !spacePermissions || spacePermissions.can_edit
  const canDelete = !spacePermissions || spacePermissions.can_delete
  function blocked(action) {
    showToast(t('paymentsPage.blockedAction', { action }))
  }

  // Masters: registros raíz de cada pago recurrente
  const masters = useMemo(() =>
    payments.filter(p => p.is_master)
  , [payments])

  const selectedMaster = selectedMasterId ? masters.find(m => m.id === selectedMasterId) || null : null

  // Botón/gesto "atrás" del teléfono — solo se intercepta cuando hay un
  // detalle abierto (mismo patrón que GoalsPage.jsx). Si estamos en la
  // lista, se deja pasar para que el botón haga lo de siempre.
  useEffect(() => {
    if (!selectedMasterId) return
    const handler = () => setSelectedMasterId(null)
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [selectedMasterId])

  // Copias pendientes del siguiente periodo (sin master)
  function getNextDue(masterId) {
    return payments
      .filter(p => p.parent_id === masterId && !p.is_paid && !p.is_master)
      .sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))[0] || null
  }

  function getPaidCount(masterId) {
    return payments.filter(p => p.parent_id === masterId && p.is_paid).length
  }

  // Métricas
  const activeMasters = masters.filter(m => !m.paused)
  const pausedMasters = masters.filter(m => m.paused)
  const totalMensual  = activeMasters
    .filter(m => !m.is_variable && m.recur_freq === 'monthly')
    .reduce((s, m) => s + Number(m.amount), 0)

  // Filtros
  const filtered = useMemo(() => {
    return masters.filter(m => {
      if (filterStatus === 'activos'  &&  m.paused) return false
      if (filterStatus === 'pausados' && !m.paused) return false
      // Filtro defensivo: is_installment puede ser null en registros viejos
      const isInstallment = m.is_installment || (m.total_installments > 0)
      if (filterType === 'recurrentes'   &&  isInstallment) return false
      if (filterType === 'parcialidades' && !isInstallment) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!m.name.toLowerCase().includes(q) && !m.category?.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [masters, filterStatus, filterType, search])

  // Agrupar por categoría
  const byCategory = useMemo(() => {
    const map = {}
    filtered.forEach(m => {
      const cat = m.category || 'Otros'
      if (!map[cat]) map[cat] = []
      map[cat].push(m)
    })
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length)
  }, [filtered])


  function formatNextDate(due_date) {
    if (!due_date) return null
    const d = dateOf(due_date)
    return `${d.getDate()} ${getMonthsShort()[d.getMonth()]}`
  }

  return (
    <div className={styles.pageRoot} onClick={() => setOpenMenu(null)}>
      <PageHeader profile={profile} unreadCount={unreadCount} onOpenNotifs={onOpenNotifs} onGoSettings={onGoSettings} />

      {/* Menú contextual flotante */}
      {openMenu && (
        <div
          onClick={e => e.stopPropagation()}
          className={styles.contextMenu}
          style={{ top: openMenu.top, bottom: openMenu.bottom, right: openMenu.right }}
        >
          {(() => {
            const master = masters.find(m => m.id === openMenu.id)
            if (!master) return null
            return (
              <>
                <MenuItem icon={<Pencil size={14} />} label={t('buttons.edit')} onClick={() => { onEdit && onEdit(master); setOpenMenu(null) }} />
                <MenuItem icon={<Trash2 size={14} />} label={t('buttons.delete')} onClick={() => { canDelete ? setConfirmDelete(master.id) : blocked(t('paymentsPage.actionDeletePayments')); setOpenMenu(null) }} danger />
              </>
            )
          })()}
        </div>
      )}

      <div className={styles.roundedContentWrapper}>
        <div className={styles.spaceSwitcherMobileWrap}>{spaceSwitcher}</div>

        {activeSpaceHeader}

        <div className={slideClass}>
          <div className={spaceJustChanged ? 'content-slide-up' : ''}>

          {activeSpaceId === 'new' ? (
            <div className={styles.newSpacePanelWrapper}>
              <NewSharedSpacePanel
                profile={profile}
                sharedSpaces={sharedSpaces}
                onOpenPremium={onOpenPremium}
                onCreated={onSpaceReady}
                onJoined={onSpaceReady}
              />
            </div>
          ) : selectedMaster ? (
            <RecurrentDetailPanel
              master={selectedMaster}
              payments={payments}
              profile={profile}
              canEdit={canEdit}
              canDelete={canDelete}
              blocked={blocked}
              onBack={() => setSelectedMasterId(null)}
              onEdit={() => onEdit && onEdit(selectedMaster)}
              onPause={() => onPause(selectedMaster.id)}
              onResume={() => onResume(selectedMaster.id)}
              onDelete={() => { onDelete && onDelete(selectedMaster.id, selectedMaster); setSelectedMasterId(null) }}
            />
          ) : (
          <>
          {/* Zona título */}
          <div className={styles.titleSection}>
            <div className={styles.titleHeading}>{t('recurrentsPage.title')}</div>
            <div className={styles.titleSubtext}>{t('recurrentsPage.subtitle')}</div>
          </div>


          {/* Buscador */}
          <div className={styles.searchWrapper}>
            <div className={styles.searchInner}>
              <div className={styles.searchIcon}>
                <Search size={15} color="var(--text)" />
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('recurrentsPage.searchPlaceholder')} className={`field-input ${styles.searchInput}`} />
            </div>
          </div>

          {/* Resumen */}
          {dataLoading ? (
            <div data-coachmark="recurrentes-stats" style={{ margin: '0 16px 14px' }}>
              <StatsCardSkeleton />
            </div>
          ) : (
            <div data-coachmark="recurrentes-stats" className={styles.statsCard}>
              <div className={styles.statsBlockBordered}>
                <div className={styles.statsLabel}>{t('recurrentsPage.activeLabel')}</div>
                <div className={styles.statsValue}>{activeMasters.length}</div>
                <div className={styles.statsSubtext}>{t('recurrentsPage.pausedCount', { count: pausedMasters.length })}</div>
              </div>
              <div className={styles.statsBlockPadded}>
                <div className={styles.statsLabel}>{t('recurrentsPage.monthlySum')}</div>
                <div className={styles.statsValue}>{fmt(totalMensual)}</div>
                <div className={styles.statsSubtext}>{t('recurrentsPage.monthlyPaymentsLabel')}</div>
              </div>
            </div>
          )}

          {/* Filtros */}
          <div className={styles.filterRow}>
            {[['todos',t('recurrentsPage.filters.all')],['activos',t('recurrentsPage.filters.active')],['pausados',t('recurrentsPage.filters.paused')]].map(([val, label]) => (
              <FilterChip key={val} label={label} active={filterStatus === val} onClick={() => setFilterStatus(val)} />
            ))}
          </div>
          <div data-coachmark="recurrentes-filtro-tipo" className={styles.filterRowLast}>
            {[['todos',t('recurrentsPage.filters.all')],['recurrentes',t('recurrentsPage.filters.recurrent')],['parcialidades',t('recurrentsPage.filters.installments')]].map(([val, label]) => (
              <FilterChip key={val} label={label} active={filterType === val} onClick={() => setFilterType(val)} />
            ))}
          </div>

          {/* Lista por categoría */}
          <div className={styles.categoryListWrapper}>
            {dataLoading ? (
              /* Fase 1 del sistema de carga por sección (agosto 2026):
                 antes, con `payments` vacío a propósito durante la carga,
                 `byCategory` quedaba en 0 y se mostraba el EmptyState real
                 ("Sin recurrentes") como si fuera un dato cierto — ahora se
                 muestra el esqueleto del acordeón mientras `dataLoading` es
                 true, nunca el EmptyState prematuro ni el hueco vacío. */
              <CategoryAccordionSkeleton count={3} />
            ) : byCategory.length === 0 ? (
              search ? (
                <div className={styles.noResultsBlock}>
                  <CreditCard size={32} color="var(--border)" className={styles.noResultsIcon} />
                  <div className={styles.noResultsText}>
                    {t('recurrentsPage.noResultsForSearch')}
                  </div>
                </div>
              ) : (
                <EmptyState title={t('recurrentsPage.noRecurrentsTitle')} subtitle={t('homePage.emptyState.subtitle')} onClick={onAdd} />
              )
            ) : byCategory.map(([cat, catMasters]) => {
              const isOpen   = !!expandedCats[cat]
              const catTotal = catMasters.filter(m => !m.is_variable && !m.paused).reduce((s, m) => s + Number(m.amount), 0)
              const catColor = getCatColor(cat, profile.custom_categories, profile.category_colors)
              const CatIcon  = getCategoryIcon(cat, profile.category_icons)

              return (
                <div key={cat} className={styles.categoryCard}>
                  {/* Header categoría */}
                  <div
                    onClick={() => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }))}
                    className={`${styles.categoryHeader} ${isOpen ? styles.categoryHeaderOpen : ''}`}
                  >
                    <div className={styles.categoryIconWrapper} style={{ background: catColor }}>
                      {CatIcon
                        ? <CatIcon size={18} color="var(--text)" strokeWidth={2} />
                        : <span className={styles.categoryFallbackDot} />
                      }
                    </div>
                    <div className={styles.categoryInfo}>
                      <div className={styles.categoryName}>{getCategoryLabel(cat)}</div>
                      <div className={styles.categoryMeta}>
                        {t('recurrentsPage.paymentCount', { count: catMasters.length })}
                        {catTotal > 0 && ` · ${fmt(catTotal)}${t('recurrentsPage.perMonthSuffix')}`}
                      </div>
                    </div>
                    <div className={`${styles.categoryChevron} ${isOpen ? styles.categoryChevronOpen : ''}`}>
                      <ChevronDown size={18} color="var(--text)" />
                    </div>
                  </div>

                  {/* Items */}
                  <div style={{ maxHeight: isOpen ? '2000px' : '0px', overflow: 'hidden', transition: 'max-height .3s ease' }}>
                    {catMasters.map((master, idx) => {
                      const isLast       = idx === catMasters.length - 1
                      const next         = getNextDue(master.id)
                      const paid         = getPaidCount(master.id)
                      const isConfirming = confirmDelete === master.id

                      return (
                        <div key={master.id}>
                          <div
                            onClick={() => setSelectedMasterId(master.id)}
                            className={`${styles.masterRow} ${styles.masterRowClickable} ${isLast && !isConfirming ? styles.masterRowNoBorder : ''}`}
                          >
                            {/* Info */}
                            <div className={styles.masterInfo}>
                              <div className={styles.masterNameRow}>
                                {master.name}
                                {master.is_variable && (
                                  <span className={styles.variableBadge}>{t('paymentsPage.variable')}</span>
                                )}
                              </div>
                              <div className={styles.masterFreqRow}>
                                {getFrequencyLabel(master.recur_freq)}
                                {!(master.is_installment || master.total_installments > 0) && paid > 0 && ` · ${t('recurrentsPage.completedCount', { count: paid })}`}
                              </div>
                              {!master.paused && next && !(master.is_installment || master.total_installments > 0) && (
                                <div className={styles.masterNextDate}>
                                  {t('recurrentsPage.nextDate', { date: formatNextDate(next.due_date) })}
                                </div>
                              )}
                              {!master.paused && next && (master.is_installment || master.total_installments > 0) && (
                                <div className={styles.masterNextDate}>
                                  {t('recurrentsPage.installmentProgress', { current: next.current_installment, total: master.total_installments })}
                                </div>
                              )}
                              {master.paused && (
                                <div className={styles.masterPausedText}>{t('recurrentsPage.paused')}</div>
                              )}
                            </div>

                            {/* Monto */}
                            {!master.is_variable && (
                              <div className={styles.masterAmount}>
                                {fmt(master.amount)}
                              </div>
                            )}

                            {/* Botones */}
                            <div className={styles.masterActionsRow}>
                              <ActionBtn
                                onClick={e => {
                                  e.stopPropagation()
                                  canEdit ? (master.paused ? onResume(master.id) : onPause(master.id)) : blocked(master.paused ? t('recurrentsPage.actionResume') : t('recurrentsPage.actionPause'))
                                }}
                                color={!canEdit ? 'var(--border)' : master.paused ? 'var(--paid)' : 'var(--warning)'}
                                label={master.paused ? t('recurrentsPage.actionResume') : t('recurrentsPage.actionPause')}
                              >
                                {master.paused
                                  ? <Play size={13} color={canEdit ? 'var(--surface)' : 'var(--muted)'} />
                                  : <Pause size={13} color={canEdit ? 'var(--surface)' : 'var(--muted)'} />
                                }
                              </ActionBtn>
                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  // Menú fijo de 2 ítems (~95px) — si no cabe
                                  // debajo antes del final de la pantalla, se
                                  // abre hacia arriba (bug real: se veía
                                  // cortado por el navbar en recurrentes
                                  // cerca del fondo de la lista).
                                  const estimatedHeight = 95
                                  const openUpward = rect.bottom + estimatedHeight > window.innerHeight
                                  setOpenMenu(openMenu?.id === master.id ? null : {
                                    id: master.id,
                                    top: openUpward ? undefined : rect.bottom + 4,
                                    bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
                                    right: window.innerWidth - rect.right,
                                  })
                                }}
                                className={styles.masterMenuButton}
                                aria-label={t('recurrentsPage.menuAriaLabel')}
                              >
                                <MoreVertical size={16} color="var(--text)" />
                              </button>
                            </div>
                          </div>

                          {/* Confirmación borrado */}
                          {isConfirming && (
                            <div className={`${styles.deleteConfirmPanel} ${isLast ? styles.deleteConfirmPanelNoBorder : ''}`}>
                              <div className={styles.deleteConfirmText}>
                                {t('recurrentsPage.deleteConfirm', { name: master.name })}
                              </div>
                              <div className={styles.deleteConfirmRow}>
                                <button onClick={() => setConfirmDelete(null)} className={styles.deleteCancelButton}>
                                  {t('buttons.cancel')}
                                </button>
                                <button onClick={() => { onDelete && onDelete(master.id, master); setConfirmDelete(null) }} className={styles.deleteConfirmButton}>
                                  {t('buttons.delete')}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

          </div>

          </>
          )}

          </div>
        </div>
      </div>
    </div>
  )
}

function ActionBtn({ onClick, color, children, label }) {
  return (
    <button onClick={onClick} className={styles.actionBtn} style={{ background: color }} aria-label={label}>
      {children}
    </button>
  )
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} className={`${styles.menuItem} ${danger ? styles.menuItemDanger : ''}`}>
      <span>{icon}</span>{label}
    </button>
  )
}
