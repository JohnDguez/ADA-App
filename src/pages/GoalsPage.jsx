import { useState, useEffect, useRef } from 'react'
import { Plus, SlidersHorizontal, Crown, PiggyBank } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { GoalDetailPanel } from '../components/GoalDetailPanel'
import { GoalFormModal } from '../components/GoalFormModal'
import { NewSharedSpacePanel } from '../components/NewSharedSpacePanel'
import { PaidByStack } from '../components/PaidByStack'
import { getIconComponent } from '../lib/categoryIcons'
import { fmt } from '../lib/utils'
import { showToast } from '../components/Toast'
import styles from './GoalsPage.module.css'

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
export function GoalsPage({
  goalsData, profile, isPremium, activeSpaceId = null, rawActiveSpaceId = null,
  spacePermissions, spaceMembers = [], spaceSwitcher, activeSpaceHeader, sharedSpaces, onSpaceReady,
  unreadCount, onOpenNotifs, onGoSettings, onOpenPremium, slideClass,
}) {
  const { activeGoals, completedGoals, totalRestante, addGoal, updateGoal, aportar, retirar, revertirAporte, markCompleted, deleteGoal } = goalsData

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
  const [editingGoal, setEditingGoal] = useState(null)
  const [sortBy, setSortBy] = useState('monto')

  // Botón/gesto "atrás" del teléfono — solo se intercepta cuando hay algo
  // "adentro" que cerrar (el form o el detalle). Si está en la lista, se
  // deja pasar para que el botón haga lo de siempre, ya que ahora esto es
  // una pestaña, no un modal encima de otra pantalla.
  useEffect(() => {
    if (!formOpen && !selectedGoalId) return
    const handler = () => {
      if (formOpen) { setFormOpen(false); return }
      setSelectedGoalId(null)
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

  function handleAddClick() {
    if (atFreeLimit) { onOpenPremium(); return }
    if (!canAdd) { showToast('No tienes permiso para crear metas en este espacio'); return }
    setEditingGoal(null)
    setFormOpen(true)
  }

  function openEdit(goal) {
    setEditingGoal(goal)
    setFormOpen(true)
  }

  async function handleFormSave(values) {
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

  return (
    <div className={styles.pageRoot}>
      <PageHeader
        profile={profile}
        unreadCount={unreadCount}
        onOpenNotifs={onOpenNotifs}
        onGoSettings={onGoSettings}
      />

      <div className={styles.roundedContentWrapper}>
        {spaceSwitcher}

        {activeSpaceHeader}

        <div className={slideClass}>
          <div className={spaceJustChanged ? 'content-slide-up' : ''}>
          {rawActiveSpaceId === 'new' ? (
            <div className={styles.newSpacePanelWrapper}>
              <NewSharedSpacePanel
                profile={profile}
                sharedSpaces={sharedSpaces}
                onOpenPremium={onOpenPremium}
                onCreated={onSpaceReady}
                onJoined={onSpaceReady}
              />
            </div>
          ) : !selectedGoal ? (
            <div className={styles.screen}>
              <div className={styles.header}>
                <div className={styles.headerTitle}>Metas</div>
              </div>

              {noGoalsAtAll ? (
                <EmptyState
                  icon={PiggyBank}
                  title="Aún no tienes ninguna meta"
                  subtitle="Crea una para empezar a apartar dinero de tu nómina"
                  onClick={handleAddClick}
                />
              ) : (
                <>
                  <div className={styles.summaryRow}>
                    <div className={styles.summaryBox}>
                      <div className={styles.summaryLabel}>Total restante</div>
                      <div className={styles.summaryValue}>{fmt(totalRestante)}</div>
                    </div>
                    <div className={styles.summaryBox}>
                      <div className={styles.summaryLabel}>Metas cumplidas</div>
                      <div className={styles.summaryValue}>{completedGoals.length}/{activeGoals.length + completedGoals.length}</div>
                    </div>
                  </div>

                  {activeGoals.length > 1 && (
                    <button
                      type="button"
                      className={styles.sortButton}
                      onClick={() => setSortBy(s => (s === 'monto' ? 'nombre' : 'monto'))}
                    >
                      <SlidersHorizontal size={13} />
                      Ordenar por {sortBy}
                    </button>
                  )}

                  <div className={styles.list}>
                    {sortedGoals.map(goal => (
                      <GoalCard key={goal.id} goal={goal} isShared={isShared} spaceMembers={spaceMembers} onClick={() => setSelectedGoalId(goal.id)} />
                    ))}
                  </div>

                  {atFreeLimit && (
                    <div className={styles.premiumBanner}>
                      <div className={styles.premiumTitle}>Obtén Premium para ahorrar en más de una meta a la vez</div>
                      <div className={styles.premiumText}>Crea todas las que quieras — tu próximo viaje, una consola, lo que se te ocurra — y ahorra para varias al mismo tiempo, en vez de quedarte solo con una activa.</div>
                      <button type="button" onClick={onOpenPremium} className={styles.premiumButton}>
                        <Crown size={16} fill="currentColor" /> Prueba Premium GRATIS 7 días
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <GoalDetailPanel
              goal={selectedGoal}
              isShared={isShared}
              canContribute={isShared ? !!spacePermissions?.can_contribute_goals : true}
              canWithdraw={isShared ? !!spacePermissions?.can_withdraw_goals : true}
              canEdit={isShared ? !!spacePermissions?.can_edit_goals : true}
              canDelete={isShared ? !!spacePermissions?.can_delete_goals : true}
              currentUserId={profile.id}
              spaceMembers={spaceMembers}
              onBack={() => setSelectedGoalId(null)}
              onEdit={() => openEdit(selectedGoal)}
              onAportar={amount => aportar(selectedGoal.id, amount, selectedGoal.name)}
              onRetirar={amount => retirar(selectedGoal.id, amount, selectedGoal.name)}
              onRevert={transactionId => revertirAporte(transactionId)}
              onMarkCompleted={completed => markCompleted(selectedGoal.id, completed)}
              onDelete={resolution => { deleteGoal(selectedGoal.id, resolution); setSelectedGoalId(null) }}
            />
          )}
          </div>
        </div>
      </div>

      {!selectedGoal && rawActiveSpaceId !== 'new' && (
        <div className={styles.addPillRow}>
          <button type="button" className={`${styles.addPill} ${(!canAdd && !atFreeLimit) ? styles.addPillDisabled : ''}`} onClick={handleAddClick}>
            <Plus size={18} color="#fff" />
            Añadir meta
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
  const Icon = getIconComponent(goal.icon) || PiggyBank

  // Contributors para PaidByStack: suma de aportes por user_id (los
  // retiros no cuentan como "quién puso el dinero", solo los aportes) —
  // mismo criterio que `payment.contributors` en usePayments.js.
  const contributors = isShared
    ? Object.values(
        goal.transactions
          .filter(t => t.type === 'aporte')
          .reduce((acc, t) => {
            acc[t.user_id] = acc[t.user_id] || { user_id: t.user_id, amount: 0 }
            acc[t.user_id].amount += Number(t.amount)
            return acc
          }, {})
      )
    : []

  return (
    <button type="button" className={`${styles.card} ${goal.isNearDeadline || goal.isOverdue ? styles.cardWarning : ''}`} onClick={onClick}>
      <div className={styles.cardTop}>
        <div className={styles.cardTitleGroup}>
          <div className={styles.cardIcon} style={{ background: goal.color }}>
            <Icon size={17} color="#fff" />
          </div>
          <span className={styles.cardName}>{goal.name}</span>
        </div>
        <span className={styles.cardTarget}>{fmt(goal.target_amount)}</span>
      </div>
      <div className={styles.cardStatsRow}>
        <span>{fmt(goal.currentAmount)} abonado</span>
        <span>{goal.percent}%</span>
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${goal.percent}%` }} />
      </div>
      <div className={styles.cardBottomRow}>
        <div className={styles.cardBottomLeft}>
          <span>Queda: {fmt(goal.remaining)}</span>
          {goal.isNearDeadline && <span className={styles.daysBadge}>Quedan {goal.daysRemaining} días</span>}
          {goal.isOverdue && <span className={styles.daysBadge}>Fecha vencida</span>}
        </div>
        {isShared && contributors.length > 0 && (
          <PaidByStack contributors={contributors} members={spaceMembers} size={20} inline />
        )}
      </div>
    </button>
  )
}
