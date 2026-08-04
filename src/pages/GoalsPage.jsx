import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, SlidersHorizontal, Crown, PiggyBank, Target, Check } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { GoalDetailPanel } from '../components/GoalDetailPanel'
import { GoalFormModal } from '../components/GoalFormModal'
import { NewSharedSpacePanel } from '../components/NewSharedSpacePanel'
import { PaidByStack } from '../components/PaidByStack'
import { getIconComponent } from '../lib/categoryIcons'
import { fmt, getMonthsShort } from '../lib/utils'
import { showToast } from '../components/Toast'
import styles from './GoalsPage.module.css'

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
  unreadCount, onOpenNotifs, onGoSettings, onOpenPremium, slideClass,
}) {
  const { t } = useTranslation()
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
  // 'activas' | 'cumplidas' — default 'activas'
  const [goalsView, setGoalsView] = useState('activas')

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
    if (!canAdd) { showToast(t('goalsPage.toast.noPermissionAdd')); return }
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
                <div className={styles.headerTitle}>{t('goalsPage.title')}</div>
              </div>

              {/* data-coachmark="metas-resumen" también en el EmptyState de
                  abajo (mismo patrón que gastos-disponible-card en
                  PaymentsPage.jsx) — un usuario nuevo con cero metas nunca
                  llega a este summaryRow real (noGoalsAtAll cae en el
                  EmptyState de arriba), así que sin el dual-tag el primer
                  paso del tour de "metas" nunca encontraba dónde anclar y
                  saltaba directo hasta el último paso (reportado por
                  Johnatan, v0.9.348). */}
              {noGoalsAtAll ? (
                <div data-coachmark="metas-resumen">
                  <EmptyState
                    icon={PiggyBank}
                    title={t('goalsPage.noGoalsAtAllTitle')}
                    subtitle={t('goalsPage.noGoalsAtAllSubtitle')}
                    onClick={handleAddClick}
                  />
                </div>
              ) : (
                <>
                  <div data-coachmark="metas-resumen" className={styles.summaryRow}>
                    <div className={styles.summaryBox}>
                      <div className={styles.summaryLabel}>{t('goalsPage.totalRemaining')}</div>
                      <div className={styles.summaryValue}>{fmt(totalRestante)}</div>
                    </div>
                    <div className={styles.summaryBox}>
                      <div className={styles.summaryLabel}>{t('goalsPage.goalsCompleted')}</div>
                      <div className={styles.summaryValue}>{completedGoals.length}/{activeGoals.length + completedGoals.length}</div>
                    </div>
                  </div>

                  {/* Switch "Activas"/"Cumplidas" — mismo patrón exacto que
                      el de HomePage.jsx ("Periodo actual"/"Próximo
                      periodo"): track + thumb deslizante, pastilla 999px. */}
                  <div data-coachmark="metas-tabs" className={styles.tabTrack}>
                    <div
                      className={styles.tabThumb}
                      style={{ transform: `translateX(${goalsView === 'cumplidas' ? 100 : 0}%)` }}
                    />
                    <button
                      type="button"
                      onClick={() => setGoalsView('activas')}
                      className={`${styles.tabButton} ${goalsView === 'activas' ? styles.tabButtonActive : ''}`}
                    >
                      {t('goalsPage.tabs.active')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setGoalsView('cumplidas')}
                      className={`${styles.tabButton} ${goalsView === 'cumplidas' ? styles.tabButtonActive : ''}`}
                    >
                      {t('goalsPage.tabs.completed')}
                    </button>
                  </div>

                  {goalsView === 'activas' ? (
                    <>
                      {activeGoals.length > 1 && (
                        <button
                          type="button"
                          className={styles.sortButton}
                          onClick={() => setSortBy(s => (s === 'monto' ? 'nombre' : 'monto'))}
                        >
                          <SlidersHorizontal size={13} />
                          {t('goalsPage.sortBy', { criteria: t(`goalsPage.sortCriteria.${sortBy}`) })}
                        </button>
                      )}

                      {activeGoals.length === 0 ? (
                        <EmptyState
                          icon={PiggyBank}
                          title={t('goalsPage.noActiveGoalsTitle')}
                          subtitle={t('goalsPage.noActiveGoalsSubtitle')}
                          onClick={handleAddClick}
                        />
                      ) : (
                        <div data-coachmark="metas-lista" className={styles.list}>
                          {sortedGoals.map(goal => (
                            <GoalCard key={goal.id} goal={goal} isShared={isShared} spaceMembers={spaceMembers} onClick={() => setSelectedGoalId(goal.id)} />
                          ))}
                        </div>
                      )}

                      {atFreeLimit && (
                        <div className={styles.premiumBanner}>
                          <div className={styles.premiumTitle}>{t('goalsPage.premiumBanner.title')}</div>
                          <div className={styles.premiumText}>{t('goalsPage.premiumBanner.text')}</div>
                          <button type="button" onClick={onOpenPremium} className={styles.premiumButton}>
                            <Crown size={16} fill="currentColor" /> {t('goalsPage.premiumBanner.button')}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    completedGoals.length === 0 ? (
                      <EmptyState
                        icon={Target}
                        title={t('goalsPage.noCompletedGoalsTitle')}
                        subtitle={t('goalsPage.noCompletedGoalsSubtitle')}
                      />
                    ) : (
                      <div className={styles.list}>
                        {completedGoals.map(goal => (
                          <GoalCard key={goal.id} goal={goal} isShared={isShared} spaceMembers={spaceMembers} onClick={() => setSelectedGoalId(goal.id)} />
                        ))}
                      </div>
                    )
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
              hasIncome={!!(profile?.salary_enabled && Number(profile?.salary_amount) > 0)}
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
        <div data-coachmark="metas-add-pill" className={styles.addPillRow}>
          <button type="button" className={`${styles.addPill} ${(!canAdd && !atFreeLimit) ? styles.addPillDisabled : ''}`} onClick={handleAddClick}>
            <Plus size={18} color="#fff" />
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
