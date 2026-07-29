import { useState, useEffect } from 'react'
import { Plus, SlidersHorizontal, Crown, PiggyBank } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { GoalDetailPanel } from '../components/GoalDetailPanel'
import { GoalFormModal } from '../components/GoalFormModal'
import { getIconComponent } from '../lib/categoryIcons'
import { fmt } from '../lib/utils'
import styles from './GoalsPage.module.css'

// Metas de ahorro — página propia del nav (antes era un overlay que se
// abría desde una bandeja en Home, ver HISTORIAL.md). Al ser una pestaña,
// ya no necesita nada de "carrocería de modal": ni fondo atenuado, ni
// franja de arrastre, ni botón "Cerrar", ni animación de entrada/salida
// propia — de la transición se encarga `slideClass`, igual que en el
// resto de las páginas.
//
// SIEMPRE muestra las metas PERSONALES, sin importar si el usuario está
// parado en un Espacio Compartido (mismo criterio que Ajustes: es tuyo, no
// del espacio). Por eso no lleva `spaceSwitcher` ni `activeSpaceHeader`, y
// cuando hay un espacio activo se avisa explícitamente para que no haya
// duda de qué está viendo. Las metas compartidas son una función aparte,
// pendiente — el schema ya quedó preparado con `space_id`.
export function GoalsPage({
  goalsData, profile, isPremium, activeSpaceId = null,
  unreadCount, onOpenNotifs, onGoSettings, onOpenPremium, slideClass,
}) {
  const { activeGoals, completedGoals, totalRestante, addGoal, updateGoal, aportar, retirar, markCompleted, deleteGoal } = goalsData

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
  // Freemium: 1 meta activa a la vez gratis — las completadas no cuentan
  // contra el límite.
  const atFreeLimit = !isPremium && activeGoals.length >= 1
  const noGoalsAtAll = activeGoals.length === 0 && completedGoals.length === 0

  function handleAddClick() {
    if (atFreeLimit) { onOpenPremium(); return }
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
        <div className={slideClass}>
          {!selectedGoal ? (
            <div className={styles.screen}>
              <div className={styles.header}>
                <div className={styles.headerTitle}>Metas</div>
              </div>

              {activeSpaceId && (
                <div className={styles.personalNote}>
                  Tus metas son personales — no cambian con el espacio compartido.
                </div>
              )}

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
                      <GoalCard key={goal.id} goal={goal} onClick={() => setSelectedGoalId(goal.id)} />
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
              onBack={() => setSelectedGoalId(null)}
              onEdit={() => openEdit(selectedGoal)}
              onAportar={amount => aportar(selectedGoal.id, amount, selectedGoal.name)}
              onRetirar={amount => retirar(selectedGoal.id, amount, selectedGoal.name)}
              onMarkCompleted={completed => markCompleted(selectedGoal.id, completed)}
              onDelete={resolution => { deleteGoal(selectedGoal.id, resolution); setSelectedGoalId(null) }}
            />
          )}
        </div>
      </div>

      {!selectedGoal && (
        <button type="button" className={styles.addPill} onClick={handleAddClick}>
          <Plus size={18} color="#fff" />
          Añadir meta
        </button>
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

function GoalCard({ goal, onClick }) {
  const Icon = getIconComponent(goal.icon) || PiggyBank
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
        <span>Queda: {fmt(goal.remaining)}</span>
        {goal.isNearDeadline && <span className={styles.daysBadge}>Quedan {goal.daysRemaining} días</span>}
        {goal.isOverdue && <span className={styles.daysBadge}>Fecha vencida</span>}
      </div>
    </button>
  )
}
