import { useState, useMemo, useRef, useEffect } from 'react'
import { Pause, Play, Trash2, Search, ChevronDown, CreditCard, Pencil, MoreVertical } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { NewSharedSpacePanel } from '../components/NewSharedSpacePanel'
import { fmt, RECUR_FREQ, dateOf, MONTHS_SHORT, getCatColor } from '../lib/utils'
import { getCategoryIcon } from '../lib/categoryIcons'
import { showToast } from '../components/Toast'
import styles from './RecurrentsPage.module.css'

function FilterChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} className={`${styles.filterChip} ${active ? styles.filterChipActive : ''}`}>
      {label}
    </button>
  )
}

export function RecurrentsPage({ payments, profile, spaceSwitcher, activeSpaceHeader, activeSpaceId = null, sharedSpaces, spacePermissions, onOpenPremium, onSpaceReady, unreadCount, onOpenNotifs, onGoSettings, onPause, onResume, onDelete, onEdit, onAdd, slideClass }) {
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

  const [search,        setSearch]        = useState('')
  const [filterStatus,  setFilterStatus]  = useState('todos')
  const [filterType,    setFilterType]    = useState('todos')
  const [expandedCats,  setExpandedCats]  = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [openMenu,      setOpenMenu]      = useState(null)

  const canEdit   = !spacePermissions || spacePermissions.can_edit
  const canDelete = !spacePermissions || spacePermissions.can_delete
  function blocked(action) {
    showToast(`No tienes permitido ${action} en este Espacio Compartido.`)
  }

  // Masters: registros raíz de cada pago recurrente
  const masters = useMemo(() =>
    payments.filter(p => p.is_master)
  , [payments])

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
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
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
                <MenuItem icon={<Pencil size={14} />} label="Editar" onClick={() => { onEdit && onEdit(master); setOpenMenu(null) }} />
                <MenuItem icon={<Trash2 size={14} />} label="Eliminar" onClick={() => { canDelete ? setConfirmDelete(master.id) : blocked('eliminar pagos'); setOpenMenu(null) }} danger />
              </>
            )
          })()}
        </div>
      )}

      <div className={styles.roundedContentWrapper}>
        {spaceSwitcher}

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
          ) : (
          <>
          {/* Zona título */}
          <div className={styles.titleSection}>
            <div className={styles.titleHeading}>Gastos recurrentes</div>
            <div className={styles.titleSubtext}>Gestiona tus pagos fijos y variables.</div>
          </div>


          {/* Buscador */}
          <div className={styles.searchWrapper}>
            <div className={styles.searchInner}>
              <div className={styles.searchIcon}>
                <Search size={15} color="var(--text)" />
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o categoría..." className={`field-input ${styles.searchInput}`} />
            </div>
          </div>

          {/* Resumen */}
          <div data-coachmark="recurrentes-stats" className={styles.statsCard}>
            <div className={styles.statsBlockBordered}>
              <div className={styles.statsLabel}>Activos</div>
              <div className={styles.statsValue}>{activeMasters.length}</div>
              <div className={styles.statsSubtext}>{pausedMasters.length} pausados</div>
            </div>
            <div className={styles.statsBlockPadded}>
              <div className={styles.statsLabel}>Suma mensual</div>
              <div className={styles.statsValue}>{fmt(totalMensual)}</div>
              <div className={styles.statsSubtext}>pagos mensuales</div>
            </div>
          </div>

          {/* Filtros */}
          <div className={styles.filterRow}>
            {[['todos','Todos'],['activos','Activos'],['pausados','Pausados']].map(([val, label]) => (
              <FilterChip key={val} label={label} active={filterStatus === val} onClick={() => setFilterStatus(val)} />
            ))}
          </div>
          <div data-coachmark="recurrentes-filtro-tipo" className={styles.filterRowLast}>
            {[['todos','Todos'],['recurrentes','Recurrentes'],['parcialidades','Parcialidades']].map(([val, label]) => (
              <FilterChip key={val} label={label} active={filterType === val} onClick={() => setFilterType(val)} />
            ))}
          </div>

          {/* Lista por categoría */}
          <div className={styles.categoryListWrapper}>
            {byCategory.length === 0 ? (
              search ? (
                <div className={styles.noResultsBlock}>
                  <CreditCard size={32} color="var(--border)" className={styles.noResultsIcon} />
                  <div className={styles.noResultsText}>
                    Sin resultados para tu búsqueda
                  </div>
                </div>
              ) : (
                <EmptyState title="Sin gastos recurrentes registrados" subtitle="Toca aquí o el botón + de abajo para añadir uno" onClick={onAdd} />
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
                      <div className={styles.categoryName}>{cat}</div>
                      <div className={styles.categoryMeta}>
                        {catMasters.length} pago{catMasters.length !== 1 ? 's' : ''}
                        {catTotal > 0 && ` · ${fmt(catTotal)}/mes`}
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
                          <div className={`${styles.masterRow} ${isLast && !isConfirming ? styles.masterRowNoBorder : ''}`}>
                            {/* Info */}
                            <div className={styles.masterInfo}>
                              <div className={styles.masterNameRow}>
                                {master.name}
                                {master.is_variable && (
                                  <span className={styles.variableBadge}>Variable</span>
                                )}
                              </div>
                              <div className={styles.masterFreqRow}>
                                {RECUR_FREQ[master.recur_freq] || master.recur_freq}
                                {!(master.is_installment || master.total_installments > 0) && paid > 0 && ` · ${paid} realizado${paid !== 1 ? 's' : ''}`}
                              </div>
                              {!master.paused && next && !(master.is_installment || master.total_installments > 0) && (
                                <div className={styles.masterNextDate}>
                                  Próximo: {formatNextDate(next.due_date)}
                                </div>
                              )}
                              {!master.paused && next && (master.is_installment || master.total_installments > 0) && (
                                <div className={styles.masterNextDate}>
                                  Pago {next.current_installment} de {master.total_installments}
                                </div>
                              )}
                              {master.paused && (
                                <div className={styles.masterPausedText}>Pausado</div>
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
                                onClick={() => canEdit ? (master.paused ? onResume(master.id) : onPause(master.id)) : blocked(master.paused ? 'reactivar pagos' : 'pausar pagos')}
                                color={!canEdit ? 'var(--border)' : master.paused ? 'var(--paid)' : 'var(--warning)'}
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
                              >
                                <MoreVertical size={16} color="var(--text)" />
                              </button>
                            </div>
                          </div>

                          {/* Confirmación borrado */}
                          {isConfirming && (
                            <div className={`${styles.deleteConfirmPanel} ${isLast ? styles.deleteConfirmPanelNoBorder : ''}`}>
                              <div className={styles.deleteConfirmText}>
                                ¿Eliminar "{master.name}"? Los pagos ya realizados se conservarán.
                              </div>
                              <div className={styles.deleteConfirmRow}>
                                <button onClick={() => setConfirmDelete(null)} className={styles.deleteCancelButton}>
                                  Cancelar
                                </button>
                                <button onClick={() => { onDelete && onDelete(master.id, master); setConfirmDelete(null) }} className={styles.deleteConfirmButton}>
                                  Eliminar
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

function ActionBtn({ onClick, color, children }) {
  return (
    <button onClick={onClick} className={styles.actionBtn} style={{ background: color }}>
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
