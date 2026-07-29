import { useState, useRef, useEffect } from 'react'
import { Plus, SlidersHorizontal, Crown, PiggyBank } from 'lucide-react'
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
  const [entering, setEntering] = useState(false)
  const wasOpenRef = useRef(open)
  const closeTimerRef = useRef(null)
  const enterTimerRef = useRef(null)
  const [selectedGoalId, setSelectedGoalId] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [sortBy, setSortBy] = useState('monto')
  const [dragCloseY, setDragCloseY] = useState(0)
  const [dragClosing, setDragClosing] = useState(false)
  const dragStartYRef = useRef(0)
  const dragMovedRef = useRef(false)

  useEffect(() => () => { clearTimeout(closeTimerRef.current); clearTimeout(enterTimerRef.current) }, [])

  // Entrada y salida (Regla 29) — la animación de entrada (`overlayEntering`)
  // solo vive en el DOM el instante en que `open` pasa de false a true, no
  // todo el tiempo que el overlay sigue abierto. Antes estaba pegada a la
  // clase base `.overlay` de forma permanente — Johnatan reportó que al
  // tocar "+" (que monta GoalFormModal como hermano nuevo, sin que `open`
  // cambie) el navegador recalculaba estilos y volvía a "disparar" la
  // animación de entrada. Con este patrón (mismo que `closing`/Select.jsx)
  // la regla de animación deja de existir en el DOM en cuanto termina, así
  // que no hay nada que un remount de un hermano pueda volver a activar.
  useEffect(() => {
    if (!wasOpenRef.current && open) {
      setEntering(true)
      clearTimeout(enterTimerRef.current)
      enterTimerRef.current = setTimeout(() => setEntering(false), ANIM_MS)
    }
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

  // Arrastrar hacia abajo desde la franja superior para cerrar — pedido
  // explícito de Johnatan en vez de un botoncito aislado lejos del pulgar.
  // Mismo criterio que GoalsTray.jsx: sigue el dedo con dragY, umbral para
  // soltar y cerrar, y un tap simple de respaldo si no hubo arrastre real.
  function startDragClose(y) {
    dragStartYRef.current = y
    dragMovedRef.current = false
    setDragClosing(true)
  }
  function moveDragClose(y) {
    const delta = y - dragStartYRef.current
    if (Math.abs(delta) > 4) dragMovedRef.current = true
    setDragCloseY(Math.max(0, Math.min(delta, 160)))
  }
  function endDragClose() {
    setDragClosing(false)
    if (dragCloseY >= 80) { onClose(); setDragCloseY(0); return }
    if (!dragMovedRef.current) onClose()
    setDragCloseY(0)
  }

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
    <>
      <div
        className={`${styles.backdrop} ${entering ? styles.backdropEntering : ''} ${closing ? styles.backdropClosing : ''}`}
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <div
          className={`${styles.sheet} ${entering ? styles.sheetEntering : ''} ${closing ? styles.sheetClosing : ''}`}
          style={dragCloseY ? { transform: `translateY(${dragCloseY}px)` } : undefined}
        >
          <div
            className={styles.dragStrip}
            onTouchStart={e => startDragClose(e.touches[0].clientY)}
            onTouchMove={e => moveDragClose(e.touches[0].clientY)}
            onTouchEnd={endDragClose}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && onClose()}
            aria-label="Cerrar Metas — desliza hacia abajo"
          >
            <div className={styles.dragHandle} />
          </div>

          <div className={styles.scrollArea}>
            {!selectedGoal ? (
              <div className={styles.screen}>
                <div className={styles.header}>
                  <div className={styles.headerTitle}>Metas</div>
                  <button type="button" className={styles.headerAddBtn} onClick={handleAddClick} aria-label="Nueva meta">
                    <Plus size={22} color="#fff" />
                  </button>
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

          {!selectedGoal && (
            <div className={styles.actionRow}>
              <button type="button" onClick={onClose} className={`btn-ghost ${styles.closeBtn}`} style={{ width: 'auto' }}>
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>

      <GoalFormModal
        open={formOpen}
        initial={editingGoal}
        onSave={handleFormSave}
        onClose={() => setFormOpen(false)}
      />
    </>
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
