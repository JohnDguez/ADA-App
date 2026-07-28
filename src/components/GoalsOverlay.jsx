import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Plus, SlidersHorizontal, Crown, PiggyBank } from 'lucide-react'
import { getIconComponent } from '../lib/categoryIcons'
import { fmt } from '../lib/utils'
import { EmptyState } from './EmptyState'
import { GoalDetailPanel } from './GoalDetailPanel'
import { GoalFormModal } from './GoalFormModal'
import styles from './GoalsOverlay.module.css'

// Debe coincidir con la duración de `.overlayClosing` en el .module.css
// (Regla 30, "JS/CSS timing sync") — mismo patrón que PANEL_ANIM_MS en
// Select.jsx.
const ANIM_MS = 280

// Pantalla completa de Metas — Fase 2. `open` lo controla App.jsx (se abre
// desde la franja de BottomNav.jsx); internamente maneja su propia
// navegación lista/detalle y el modal de crear/editar, para no ensuciar
// App.jsx con estados que solo le importan a Metas.
export function GoalsOverlay({ open, goalsData, isPremium, onClose, onOpenPremium }) {
  const { activeGoals, completedGoals, totalRestante, addGoal, updateGoal, aportar, retirar, markCompleted, deleteGoal } = goalsData

  const [closing, setClosing] = useState(false)
  const wasOpenRef = useRef(open)
  const closeTimerRef = useRef(null)
  const [selectedGoalId, setSelectedGoalId] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [sortBy, setSortBy] = useState('monto')

  useEffect(() => () => clearTimeout(closeTimerRef.current), [])

  // Animación de salida (Regla 29) — mismo patrón que Select.jsx: al pasar
  // de open=true a false, se queda montado `ANIM_MS` más para que la
  // animación de salida del CSS alcance a correr, en vez de desaparecer de
  // golpe.
  useEffect(() => {
    if (wasOpenRef.current && !open) {
      setClosing(true)
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = setTimeout(() => setClosing(false), ANIM_MS)
    }
    wasOpenRef.current = open
  }, [open])

  useEffect(() => {
    if (open) { document.body.classList.add('modal-open'); setSelectedGoalId(null) }
    else document.body.classList.remove('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [open])

  // Botón/gesto "atrás" del teléfono — mismo patrón que VariableAmountModal:
  // primero cierra lo más "interno" (el form, luego el detalle) antes de
  // cerrar todo el overlay.
  useEffect(() => {
    if (!open) return
    const handler = () => {
      if (formOpen) { setFormOpen(false); return }
      if (selectedGoalId) { setSelectedGoalId(null); return }
      onClose()
    }
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [open, selectedGoalId, formOpen])

  const showOverlay = open || closing
  if (!showOverlay) return null

  const sortedGoals = [...activeGoals].sort((a, b) =>
    sortBy === 'nombre' ? a.name.localeCompare(b.name) : b.target_amount - a.target_amount
  )
  const selectedGoal = selectedGoalId
    ? [...activeGoals, ...completedGoals].find(g => g.id === selectedGoalId)
    : null
  // Freemium: 1 meta activa a la vez gratis — completadas no cuentan
  // contra el límite (decisión confirmada con Johnatan).
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
    <div className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`}>
      {!selectedGoal ? (
        <div className={styles.screen}>
          <div className={styles.header}>
            <button onClick={onClose} className={styles.closeButton} aria-label="Cerrar Metas">
              <ChevronDown size={22} color="var(--text)" />
            </button>
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
                  <GoalCard key={goal.id} goal={goal} onClick={() => setSelectedGoalId(goal.id)} />
                ))}
              </div>

              {atFreeLimit && (
                <div className={styles.premiumBanner}>
                  <div className={styles.premiumText}>
                    <Crown size={14} color="var(--premium-gold)" />
                    <span>Obtén Premium para más metas a la vez</span>
                  </div>
                  <button type="button" onClick={onOpenPremium} className={styles.premiumButton}>
                    <Crown size={13} />
                    Ver Premium
                  </button>
                </div>
              )}
            </>
          )}

          <button type="button" className={styles.fab} onClick={handleAddClick} aria-label="Nueva meta">
            <Plus size={24} color="#fff" />
          </button>
        </div>
      ) : (
        <GoalDetailPanel
          goal={selectedGoal}
          onBack={() => setSelectedGoalId(null)}
          onEdit={() => openEdit(selectedGoal)}
          onAportar={amount => aportar(selectedGoal.id, amount)}
          onRetirar={amount => retirar(selectedGoal.id, amount, selectedGoal.name)}
          onMarkCompleted={completed => markCompleted(selectedGoal.id, completed)}
          onDelete={resolution => { deleteGoal(selectedGoal.id, resolution); setSelectedGoalId(null) }}
        />
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
