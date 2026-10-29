import { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Pause, Play, Trash2, Search, ChevronDown, CreditCard, Pencil, MoreVertical, Loader2, CalendarDays, Info } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { NewSharedSpacePanel } from '../components/NewSharedSpacePanel'
import { RecurrentDetailPanel } from '../components/RecurrentDetailPanel'
import { installmentUntrackedCount, RECUR_FREQ, dateOf, getMonthsShort, monthlyEquivalent } from '../lib/utils'
import { showToast } from '../components/Toast'
import { StatsCardSkeleton, CategoryAccordionSkeleton } from '../components/SkeletonLoader'
import styles from './RecurrentsPage.module.css'
import { markBackHandled } from '../lib/backNav'
import { useScrollTop } from '../hooks/useScrollTop'
import { useScrollLock } from '../lib/scrollLock'
import { Collapse } from '../components/Collapse'
import { usePresence } from '../lib/usePresence'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useIsMobile } from '../hooks/useIsMobile'
import { MobileRecurrents } from './MobileRecurrents'
import { DeskRecurrents } from './DeskRecurrents'

function FilterChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} className={`${styles.filterChip} ${active ? styles.filterChipActive : ''}`}>
      {label}
    </button>
  )
}

export function RecurrentsPage({ payments, dataLoading = false, profile, spaceSwitcher, activeSpaceHeader, activeSpaceId = null, sharedSpaces, spacePermissions, onOpenPremium, onSpaceReady, unreadCount, onOpenNotifs, onGoSettings, onPause, onResume, onDelete, onEdit, onAdd, onStartAdd, slideClass }) {
  const { t } = useTranslation()
  const isDesktop = useIsDesktop()
  const isMobile = useIsMobile()
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
  const [confirmDelete,   setConfirmDelete]   = useState(null)
  const [openMenu,        setOpenMenu]        = useState(null)
  const menuPresence = usePresence(!!openMenu)
  const lastMenuRef = useRef(null)
  if (openMenu) lastMenuRef.current = openMenu
  const menuShown = openMenu || (menuPresence.render ? lastMenuRef.current : null)
  useScrollLock(!!openMenu)
  const [selectedMasterId, setSelectedMasterId] = useState(null)
  useScrollTop(selectedMasterId)

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
    const handler = () => { markBackHandled(); setSelectedMasterId(null) }
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [selectedMasterId])

  // Copias pendientes del siguiente periodo (sin master)
  // `!p.is_postponed` (agosto 2026) — sin esto, una copia recién pospuesta
  // se seguía mostrando como "próxima" (con una fecha ya pasada), en vez de
  // que la app muestre la copia real que sigue en la cola.
  function getNextDue(masterId) {
    return payments
      .filter(p => p.parent_id === masterId && !p.is_paid && !p.is_postponed && !p.is_master)
      .sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))[0] || null
  }

  function getPaidCount(masterId) {
    return payments.filter(p => p.parent_id === masterId && p.is_paid).length
  }

  // Pagos ya hechos de una parcialidad. `getPaidCount` solo ve las copias
  // cargadas en memoria (últimos 3 meses) y no las anteriores al primer
  // registro; el siguiente pendiente (N) ya implica N-1 pagados — igual que
  // el detalle (v0.9.830, «dice 7 y van 11»).
  function installmentPaid(m) {
    const next = getNextDue(m.id)
    const n = Number(next?.current_installment)
    if (n > 0) return Math.min(m.total_installments || n - 1, n - 1)
    return Math.min(m.total_installments || Infinity, getPaidCount(m.id) + installmentUntrackedCount(m, payments))
  }

  // Métricas
  const activeMasters = masters.filter(m => !m.paused)
  const pausedMasters = masters.filter(m => m.paused)
  // v0.9.759 — suma de TODAS las frecuencias, cada una a su equivalente
  // mensual (antes solo contaba las mensuales y cada categoría sumaba el
  // monto crudo de semanales/anuales como si fueran "/mes").
  const totalMensual  = activeMasters.reduce((s, m) => s + monthlyEquivalent(m), 0)
  const variableCount = activeMasters.filter(m => m.is_variable).length
  const FREQ_ORDER = ['weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual']
  const freqRows = FREQ_ORDER
    .map(freq => {
      const list = activeMasters.filter(m => !m.is_variable && m.recur_freq === freq)
      return { freq, count: list.length, amount: list.reduce((s, m) => s + monthlyEquivalent(m), 0) }
    })
    .filter(r => r.count > 0)
  const freqMax = Math.max(1, ...freqRows.map(r => r.amount))
  const isInstallmentMaster = m => m.is_installment || m.total_installments > 0
  const installmentMasters = activeMasters.filter(isInstallmentMaster)
  const installmentsLeft = installmentMasters.reduce((s, m) => s + Math.max(0, (m.total_installments || 0) - installmentPaid(m)), 0)
  const installmentsLeftAmount = installmentMasters.reduce((s, m) => s + Number(m.amount || 0) * Math.max(0, (m.total_installments || 0) - installmentPaid(m)), 0)

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

  const deskData = {
    profile, dataLoading, activeSpaceId, sharedSpaces, spacePermissions, slideClass, spaceJustChanged, onOpenPremium, onSpaceReady, onAdd, onStartAdd,
    search, setSearch, filterStatus, setFilterStatus, filterType, setFilterType, byCategory,
    totals: { active: activeMasters.length, paused: pausedMasters.length, all: masters.length, monthly: totalMensual },
    freqRows, freqMax, variableCount,
    installments: { count: installmentMasters.length, left: installmentsLeft, leftAmount: installmentsLeftAmount, items: installmentMasters.map(m => ({ id: m.id, name: m.name, category: m.category, paid: installmentPaid(m), total: m.total_installments || 0, amount: Number(m.amount || 0) })) },
    getNextDue, getPaidCount, formatNextDate,
    canEdit, canDelete, blocked, onPause, onResume, onEdit, onDelete, payments, selectedMaster, setSelectedMasterId,
    openMenu, setOpenMenu, confirmDelete, setConfirmDelete,
  }

  return (
    <div className={`${styles.pageRoot} ${!isMobile ? styles.pageRootDesk : ''}`} onClick={() => setOpenMenu(null)}>
      {/* Oculto desde 768px — mismo criterio que HomePage/PaymentsPage:
          NavRail.jsx ya cubre avatar, saludo, notificaciones y config. */}
      {!isDesktop && <div className={styles.pageHeaderWrapper}>
        <PageHeader profile={profile} unreadCount={unreadCount} onOpenNotifs={onOpenNotifs} onGoSettings={onGoSettings} onOpenPremium={onOpenPremium} {...(isMobile ? { variant: 'home', title: t('recurrentsPage.title') } : {})} />
      </div>}

      {/* Menú contextual flotante */}
      {menuShown && (
        <div
          onClick={e => e.stopPropagation()}
          className={styles.contextMenu}
          data-closing={openMenu ? undefined : ''}
          style={{ top: menuShown.top, bottom: menuShown.bottom, right: menuShown.right }}
        >
          {(() => {
            const master = masters.find(m => m.id === menuShown.id)
            if (!master) return null
            return (
              <>
                {isMobile && getPaidCount(master.id) > 0 && !(master.is_installment || master.total_installments > 0) && (
                  <div className={styles.menuInfo}>{t('recurrentsPage.completedCount', { count: getPaidCount(master.id) })}</div>
                )}
                <MenuItem icon={<Pencil size={14} />} label={t('buttons.edit')} onClick={() => { onEdit && onEdit(master); setOpenMenu(null) }} />
                {isMobile && (
                  <MenuItem icon={master.paused ? <Play size={14} /> : <Pause size={14} />} label={master.paused ? t('mobileRecurrents.resume') : t('mobileRecurrents.pause')}
                    onClick={() => { canEdit ? (master.paused ? onResume(master.id) : onPause(master.id)) : blocked(master.paused ? t('recurrentsPage.actionResume') : t('recurrentsPage.actionPause')); setOpenMenu(null) }} />
                )}
                <MenuItem icon={<Trash2 size={14} />} label={t('buttons.delete')} onClick={() => { canDelete ? setConfirmDelete(master.id) : blocked(t('paymentsPage.actionDeletePayments')); setOpenMenu(null) }} danger />
              </>
            )
          })()}
        </div>
      )}

      {isDesktop ? <DeskRecurrents d={deskData} /> : !isMobile ? <DeskRecurrents d={deskData} tablet /> : (
        <>
          <div className={styles.spaceSwitcherMobileWrap}>{spaceSwitcher}</div>
          {activeSpaceHeader}
          <div className={slideClass}>
            <div className={spaceJustChanged ? 'content-slide-up' : ''}>
              {activeSpaceId === 'new' ? (
                <div className={styles.newSpacePanelWrapper}>
                  <NewSharedSpacePanel profile={profile} sharedSpaces={sharedSpaces} onOpenPremium={onOpenPremium} onCreated={onSpaceReady} onJoined={onSpaceReady} />
                </div>
              ) : selectedMaster ? (
                <RecurrentDetailPanel
                  master={selectedMaster} payments={payments} profile={profile} canEdit={canEdit} canDelete={canDelete} blocked={blocked} mobile
                  onBack={() => setSelectedMasterId(null)}
                  onEdit={() => onEdit && onEdit(selectedMaster)}
                  onPause={() => onPause(selectedMaster.id)}
                  onResume={() => onResume(selectedMaster.id)}
                  onDelete={() => { onDelete && onDelete(selectedMaster.id, selectedMaster); setSelectedMasterId(null) }} />
              ) : (
                <MobileRecurrents d={deskData} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ActionBtn({ onClick, color, children, label, disabled = false }) {
  return (
    <button onClick={onClick} disabled={disabled} className={styles.actionBtn} style={{ background: color }} aria-label={label}>
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
