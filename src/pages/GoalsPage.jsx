import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, SlidersHorizontal, Crown, PiggyBank, Target, Check, Loader2 } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { GoalDetailPanel } from '../components/GoalDetailPanel'
import { GoalFormModal } from '../components/GoalFormModal'
import { NewSharedSpacePanel } from '../components/NewSharedSpacePanel'
import { PaidByStack } from '../components/PaidByStack'
import { getIconComponent } from '../lib/categoryIcons'
import { fmt, getMonthsShort } from '../lib/utils'
import { showToast } from '../components/Toast'
import { GoalCardSkeleton } from '../components/SkeletonLoader'
import styles from './GoalsPage.module.css'
import { markBackHandled, wasBackHandled } from '../lib/backNav'
import { useScrollTop } from '../hooks/useScrollTop'
import { Collapse } from '../components/Collapse'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { DeskGoals } from './DeskGoals'
import { MobileGoals } from './MobileGoals'
import { useIsMobile } from '../hooks/useIsMobile'

function fmtDate(iso) {
  const d = new Date(iso)
  return `${d.getDate()} ${getMonthsShort()[d.getMonth()]} ${d.getFullYear()}`
}

// Metas de ahorro — página propia del nav (antes era un overlay que se
// abría desde una bandeja en Home, ver HISTORIAL.md). Al ser una pestaña,
// ya no necesita nada de "carrocería de modal": ni fondo atenuado, ni
// franja de arrastre, ni botón "Cerrar", ni animación de entrada/salida
// propia — de la transición se encarga `slideClass`, igual que en el
// resto de las páginas.
//
// Sigue al espacio activo, igual que Gastos/Recurrentes (`useGoals` recibe
// `paymentsSpaceId` desde App.jsx) — antes esta pestaña era la única
// inconsistente (siempre personal sin importar el espacio), justo lo que
// originó retomar las metas compartidas. `spacePermissions` trae también
// los 5 permisos de Metas (`can_add_goals`/etc., ver RULES.md/CONTEXT.md),
// mismo objeto que ya usan Gastos/Recurrentes — `isRestricted: false`
// cuando es personal o cuando el usuario es dueño del espacio.
//
// NUEVO (v0.9.317): switch "Activas"/"Cumplidas" — antes una meta
// cumplida desaparecía de la vista sin forma de revisarla o reabrirla.
// Reutiliza EXACTO el patrón de HomePage.jsx (tabTrack/tabThumb/tabButton,
// pastilla 999px, misma curva de animación) — ver GoalsPage.module.css.
export function GoalsPage({
  goalsData, profile, isPremium, activeSpaceId = null, rawActiveSpaceId = null,
  spacePermissions, spaceMembers = [], spaceSwitcher, activeSpaceHeader, sharedSpaces, onSpaceReady,
  unreadCount, onOpenNotifs, onGoSettings, onOpenPremium, slideClass, paymentMethods = null,
}) {
  const { t } = useTranslation()
  const isDesktop = useIsDesktop()
  const isMobile = useIsMobile()
  const { activeGoals, completedGoals, totalRestante, loading: goalsLoading, addGoal, updateGoal, aportar, retirar, revertirAporte, markCompleted, deleteGoal } = goalsData

  // Mismo criterio que RecurrentsPage.jsx: la animación de entrada del
  // contenido solo se dispara en un cambio REAL de espacio (comparado
  // contra la referencia anterior), no en un simple cambio de pestaña que
  // vuelve a montar esta página con el mismo espacio de siempre.
  const prevSpaceRef = useRef(rawActiveSpaceId)
  const [spaceJustChanged, setSpaceJustChanged] = useState(false)
  useEffect(() => {
    if (prevSpaceRef.current !== rawActiveSpaceId) {
      setSpaceJustChanged(true)
      prevSpaceRef.current = rawActiveSpaceId
      const timer = setTimeout(() => setSpaceJustChanged(false), 300)
      return () => clearTimeout(timer)
    }
  }, [rawActiveSpaceId])

  const [selectedGoalId, setSelectedGoalId] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  useScrollTop(selectedGoalId, formOpen)
  const [editingGoal, setEditingGoal] = useState(null)
  const [sortBy, setSortBy] = useState('monto')
  // 'activas' | 'cumplidas' — default 'activas'
  const [goalsView, setGoalsView] = useState('activas')

  // Botón/gesto "atrás" del teléfono — solo se intercepta cuando hay algo
  // "adentro" que cerrar (el form o el detalle). Si está en la lista, se
  // deja pasar para que el botón haga lo de siempre, ya que ahora esto es
  // una pestaña, no un modal encima de otra pantalla.
  useEffect(() => {
    if (!formOpen && !selectedGoalId) return
    // Se decide un instante después: si "Añadir tarjeta" (CardFormModal,
    // abierto encima del detalle al aportar) ya atendió este "atrás", el
    // detalle de la meta se queda.
    const handler = () => {
      setTimeout(() => {
        if (wasBackHandled()) return
        markBackHandled()
        if (formOpen) { setFormOpen(false); return }
        setSelectedGoalId(null)
      }, 0)
    }
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [selectedGoalId, formOpen])

  const sortedGoals = [...activeGoals].sort((a, b) =>
    sortBy === 'nombre' ? a.name.localeCompare(b.name) : b.target_amount - a.target_amount
  )
  const selectedGoal = selectedGoalId
    ? [...activeGoals, ...completedGoals].find(g => g.id === selectedGoalId)
    : null
  const isShared = !!activeSpaceId
  // Freemium (1 gratis) solo aplica en Personal — en un espacio ya es
  // ilimitado (el espacio ya es Premium, decisión ya tomada). En un
  // espacio, lo que sí limita es el permiso `can_add_goals`.
  const atFreeLimit = !isShared && !isPremium && activeGoals.length >= 1
  const canAdd = isShared ? !!spacePermissions?.can_add_goals : true
  const noGoalsAtAll = activeGoals.length === 0 && completedGoals.length === 0
  const totalAhorrado = activeGoals.reduce((s, g) => s + Number(g.currentAmount || 0), 0)

  function handleAddClick() {
    if (atFreeLimit) { onOpenPremium(); return }
    if (!canAdd) { showToast(t('goalsPage.toast.noPermissionAdd')); return }
    setEditingGoal(null)
    setFormOpen(true)
  }

  function openEdit(goal) {
    setEditingGoal(goal)
    setFormOpen(true)
  }

  // Personal (v0.9.483): el cambio ya se ve al instante (useGoals optimista),
  // así que el formulario cierra sin esperar al servidor. Compartida: espera
  // al endpoint, como siempre.
  async function handleFormSave(values) {
    if (!isShared) {
      if (editingGoal) {
        updateGoal(editingGoal.id, {
          name: values.name.trim(),
          notes: values.notes?.trim() || null,
          icon: values.icon,
          color: values.color,
          target_amount: values.targetAmount,
          target_date: values.targetDate || null,
        })
      } else {
        addGoal(values)
      }
      setFormOpen(false)
      return
    }
    if (editingGoal) {
      await updateGoal(editingGoal.id, {
        name: values.name.trim(),
        notes: values.notes?.trim() || null,
        icon: values.icon,
        color: values.color,
        target_amount: values.targetAmount,
        target_date: values.targetDate || null,
      })
    } else {
      await addGoal(values)
    }
    setFormOpen(false)
  }

  const deskData = {
    profile, goalsLoading, rawActiveSpaceId, sharedSpaces, onOpenPremium, onSpaceReady, slideClass, spaceJustChanged,
    isShared, spaceMembers, canAdd, atFreeLimit, onAdd: handleAddClick, noGoalsAtAll,
    activeGoals, completedGoals, sortedGoals, sortBy, setSortBy, goalsView, setGoalsView,
    totalRestante, totalAhorrado, selectedGoal, setSelectedGoalId,
    detailProps: selectedGoal ? {
      isShared,
      canContribute: isShared ? !!spacePermissions?.can_contribute_goals : true,
      canWithdraw: isShared ? !!spacePermissions?.can_withdraw_goals : true,
      canEdit: isShared ? !!spacePermissions?.can_edit_goals : true,
      canDelete: isShared ? !!spacePermissions?.can_delete_goals : true,
      currentUserId: profile.id, spaceMembers,
      hasIncome: !!(profile?.salary_enabled && Number(profile?.salary_amount) > 0),
      onBack: () => setSelectedGoalId(null),
      onEdit: () => openEdit(selectedGoal),
      onAportar: (amount, method) => aportar(selectedGoal.id, amount, selectedGoal.name, method),
      paymentMethods,
      onRetirar: amount => retirar(selectedGoal.id, amount, selectedGoal.name),
      onRevert: transactionId => revertirAporte(transactionId),
      onMarkCompleted: completed => markCompleted(selectedGoal.id, completed),
      onDelete: resolution => { deleteGoal(selectedGoal.id, resolution); setSelectedGoalId(null) },
    } : null,
  }

  return (
    <div className={`${styles.pageRoot} ${!isMobile ? styles.pageRootDesk : ''}`}>
      {/* Oculto desde 768px — NavRail.jsx ya cubre avatar, saludo,
          notificaciones y config (mismo criterio que las demás páginas). */}
      {!isDesktop && <div className={styles.pageHeaderWrapper}>
        <PageHeader
          profile={profile}
          unreadCount={unreadCount}
          onOpenNotifs={onOpenNotifs}
          onGoSettings={onGoSettings}
          onOpenPremium={onOpenPremium}
          {...(isMobile ? { variant: 'home', title: t('goalsPage.title') } : {})}
        />
      </div>}

      {isDesktop ? <DeskGoals d={deskData} /> : !isMobile ? <DeskGoals d={deskData} tablet /> : (
        <>
          <div className={styles.spaceSwitcherMobileWrap}>{spaceSwitcher}</div>
          {activeSpaceHeader}
          <div className={slideClass}>
            <div className={spaceJustChanged ? 'content-slide-up' : ''}>
              {rawActiveSpaceId === 'new' ? (
                <div className={styles.newSpacePanelWrapper}>
                  <NewSharedSpacePanel profile={profile} sharedSpaces={sharedSpaces} onOpenPremium={onOpenPremium} onCreated={onSpaceReady} onJoined={onSpaceReady} />
                </div>
              ) : selectedGoal ? (
                <GoalDetailPanel key={selectedGoal.id} goal={selectedGoal} mobile {...deskData.detailProps} />
              ) : (
                <MobileGoals d={deskData} />
              )}
            </div>
          </div>
        </>
      )}

      {!isDesktop && !selectedGoal && rawActiveSpaceId !== 'new' && (
        <div data-coachmark="metas-add-pill" className={styles.addPillRow}>
          <button type="button" className={`${styles.addPill} ${(!canAdd && !atFreeLimit) ? styles.addPillDisabled : ''}`} onClick={handleAddClick}>
            <Plus size={18} color="var(--on-color)" />
            {t('goalsPage.addGoal')}
          </button>
        </div>
      )}

      <GoalFormModal
        open={formOpen}
        initial={editingGoal}
        onSave={handleFormSave}
        onClose={() => setFormOpen(false)}
      />
    </div>
  )
}

function GoalCard({ goal, isShared, spaceMembers, onClick }) {
  const { t } = useTranslation()
  const Icon = getIconComponent(goal.icon) || PiggyBank
  const isCompleted = goal.is_completed
  // Una meta cumplida siempre se muestra al 100% en la barra — puede
  // haberse marcado como hecha antes de llegar al monto real (el usuario
  // puso el restante de su bolsillo, ver GoalDetailPanel.jsx), pero visualmente
  // ya está completa.
  const displayPercent = isCompleted ? 100 : goal.percent

  // Contributors para PaidByStack: NETO por user_id — aporte suma, retiro
  // resta (bug real reportado por Johnatan: alguien que aportó $700 y
  // luego retiró $200 de eso mismo seguía apareciendo con $700 puestos,
  // cuando en realidad solo tiene $500 netos abonados). Se filtran los
  // netos en 0 o negativos — si alguien retiró todo lo que había puesto,
  // ya no debe aparecer como aportante.
  const contributors = isShared
    ? Object.values(
        goal.transactions
          .reduce((acc, t) => {
            acc[t.user_id] = acc[t.user_id] || { user_id: t.user_id, amount: 0 }
            acc[t.user_id].amount += t.type === 'aporte' ? Number(t.amount) : -Number(t.amount)
            return acc
          }, {})
      ).filter(c => c.amount > 0)
    : []

  return (
    <button type="button" data-goal-id={goal.id} className={`${styles.card} ${goal.isNearDeadline || goal.isOverdue ? styles.cardWarning : ''}`} onClick={onClick}>
      <div className={styles.cardTop}>
        <div className={styles.cardTitleGroup}>
          <div className={styles.cardIcon} style={{ background: goal.color }}>
            <Icon size={17} color="var(--on-color)" />
          </div>
          <span className={styles.cardName}>{goal.name}</span>
        </div>
        <span className={styles.cardTargetGroup}>
          <span className={styles.cardTarget}>{fmt(goal.target_amount)}</span>
          {/* Sincronizando (v0.9.483) — ver useGoals.js */}
          {goal._syncing && (
            <span className="sync-spinner" aria-label={t('sync.syncing')}><Loader2 size={14} color="var(--text)" /></span>
          )}
        </span>
      </div>
      <div className={styles.cardStatsRow}>
        <span>{t('goalsPage.card.deposited', { amount: fmt(goal.currentAmount) })}</span>
        <span>{displayPercent}%</span>
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${displayPercent}%` }} />
      </div>
      {isCompleted ? (
        <div className={styles.cardBottomRow}>
          <span className={styles.completedText}>{t('goalsPage.card.completedOn', { date: fmtDate(goal.completed_at) })}</span>
          {isShared && contributors.length > 0 ? (
            <PaidByStack contributors={contributors} members={spaceMembers} size={20} inline />
          ) : (
            <Check size={16} className={styles.completedCheck} color="var(--paid)" />
          )}
        </div>
      ) : (
        <div className={styles.cardBottomRow}>
          <div className={styles.cardBottomLeft}>
            <span>{t('goalsPage.card.remaining', { amount: fmt(goal.remaining) })}</span>
            {goal.isNearDeadline && <span className={styles.daysBadge}>{t('goalsPage.card.daysRemaining', { count: goal.daysRemaining })}</span>}
            {goal.isOverdue && <span className={styles.daysBadge}>{t('goalsPage.card.overdue')}</span>}
          </div>
          {isShared && contributors.length > 0 && (
            <PaidByStack contributors={contributors} members={spaceMembers} size={20} inline />
          )}
        </div>
      )}
    </button>
  )
}
