import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, MoreVertical, ArrowUp, ArrowDown, Check, ArrowUpCircle, ArrowDownCircle, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { getIconComponent } from '../lib/categoryIcons'
import { fmt, MONTHS_SHORT } from '../lib/utils'
import { showToast } from './Toast'
import { DeleteGoalModal } from './DeleteGoalModal'
import styles from './GoalDetailPanel.module.css'

function fmtDate(iso) {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

// `isShared`/`can*`/`currentUserId`/`onRevert` solo importan en una meta de
// Espacio Compartido — en personal siempre llegan con sus defaults (todo
// permitido, `onRevert` no se usa porque ahí "Retirar" ya cumple ese rol).
// "Retirar" y "Aportar" NUNCA se esconden por falta de permiso — se
// quedan visibles pero avisan el motivo al tocarlos (decisión de
// Johnatan: esconder el botón confunde más que bloquearlo con explicación).
export function GoalDetailPanel({
  goal, onBack, onEdit, onAportar, onRetirar, onRevert, onMarkCompleted, onDelete,
  isShared = false, canContribute = true, canWithdraw = true, canEdit = true, canDelete = true, currentUserId = null, spaceMembers = [],
  hasIncome = true,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeAction, setActiveAction] = useState(null) // null | 'aportar' | 'retirar'
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [completing, setCompleting] = useState(false)
  const menuRef = useRef(null)

  // Cerrar el menú al tocar en cualquier otro lado — se escucha en
  // `document` y no solo en el contenedor de la página, para que también
  // se cierre tocando el header o el nav, no solo el contenido.
  useEffect(() => {
    if (!menuOpen) return
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [menuOpen])

  const Icon = getIconComponent(goal.icon)
  const showMenu = canEdit || canDelete

  function openAction(type) {
    if (type === 'aportar' && !canContribute) { showToast('No tienes permiso para aportar a metas en este espacio'); return }
    if (type === 'retirar' && !canWithdraw) { showToast('No tienes permiso para retirar de las metas en este espacio'); return }
    setActiveAction(type)
    setAmount('')
    setMenuOpen(false)
  }

  async function confirmAction() {
    const val = parseFloat(amount)
    if (!val || val <= 0) { showToast('Ingresa un monto válido'); return }
    if (activeAction === 'retirar' && val > goal.currentAmount) {
      showToast(`No puedes retirar más de lo abonado (${fmt(goal.currentAmount)})`)
      return
    }
    setSaving(true)
    const { error } = activeAction === 'aportar' ? await onAportar(val) : await onRetirar(val)
    setSaving(false)
    if (error) { showToast(error.message || 'Error al guardar'); return }
    showToast(activeAction === 'aportar' ? 'Aporte registrado' : 'Retiro registrado — ya está en tu Disponible')
    setActiveAction(null)
  }

  async function handleRevert(tx) {
    const { error } = await onRevert(tx.id)
    if (error) { showToast(error.message || 'No se pudo revertir'); return }
    showToast('Aporte revertido')
  }

  // "Marcar como hecha" — completar antes de llegar al monto es
  // automático (no se pregunta): `onMarkCompleted` ya resuelve, según el
  // ingreso por periodo del usuario, si el restante sale de su nómina
  // (aporte real) o si solo se registra el monto sin pago (ver
  // useGoals.js/manage-shared-goal.js). Aquí solo se informa el
  // resultado con un toast.
  async function handleMarkComplete() {
    const goalRemaining = goal.remaining
    setCompleting(true)
    const { error } = await onMarkCompleted(true)
    setCompleting(false)
    if (error) { showToast(error.message || 'No se pudo completar la meta'); return }
    if (goalRemaining > 0) {
      showToast(
        hasIncome
          ? `Meta completada — se aportaron ${fmt(goalRemaining)} de tu nómina`
          : 'Meta completada — sin ingreso activo no se descontó nada, solo se registró el monto'
      )
    } else {
      showToast('¡Meta completada!')
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button type="button" onClick={onBack} className={styles.iconButton} aria-label="Regresar">
          <ChevronLeft size={22} color="var(--text)" />
        </button>
        <div className={styles.headerIcon} style={{ background: goal.color }}>
          {Icon && <Icon size={15} color="#fff" />}
        </div>
        <div className={styles.headerTitle}>{goal.name}</div>
        {showMenu && (
          <div className={styles.menuWrapper} ref={menuRef}>
            <button type="button" onClick={() => setMenuOpen(o => !o)} className={styles.iconButton} aria-label="Más opciones">
              <MoreVertical size={20} color="var(--text)" />
            </button>
            {menuOpen && (
              <div className={styles.menu}>
                {goal.is_completed ? (
                  canEdit && (
                    <button type="button" onClick={() => { setMenuOpen(false); onMarkCompleted(false) }} className={styles.menuItem}>
                      <span><RotateCcw size={14} /></span>Reabrir
                    </button>
                  )
                ) : (
                  canEdit && (
                    <button type="button" onClick={() => { setMenuOpen(false); onEdit() }} className={styles.menuItem}>
                      <span><Pencil size={14} /></span>Editar
                    </button>
                  )
                )}
                {canDelete && (
                  <button type="button" onClick={() => { setMenuOpen(false); setDeleteModalOpen(true) }} className={`${styles.menuItem} ${styles.menuItemDanger}`}>
                    <span><Trash2 size={14} /></span>Eliminar
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.ring} style={{ background: `conic-gradient(var(--paid) 0% ${goal.percent}%, var(--border) ${goal.percent}% 100%)` }}>
        <div className={styles.ringInner}>
          <div className={styles.ringPercent}>{goal.percent}%</div>
          <div className={styles.ringAmounts}>{fmt(goal.currentAmount)} / {fmt(goal.target_amount)}</div>
        </div>
      </div>

      <div className={styles.metaRow}>
        {goal.target_date && (
          <span className={`${styles.deadlineBadge} ${goal.isOverdue ? styles.deadlineOverdue : ''}`}>
            {goal.isOverdue ? 'Fecha vencida' : `Quedan ${goal.daysRemaining} días`}
          </span>
        )}
      </div>
      <div className={styles.createdAt}>Creada el {fmtDate(goal.created_at)}</div>
      {goal.notes && <div className={styles.notes}>{goal.notes}</div>}

      {activeAction ? (
        <div className={styles.actionForm}>
          <label className="field-label">{activeAction === 'aportar' ? 'Monto a aportar' : 'Monto a retirar'}</label>
          <input
            autoFocus
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            onKeyDown={e => e.key === 'Enter' && confirmAction()}
            className={`field-input ${styles.actionInput}`}
          />
          <div className={styles.actionButtons}>
            <button type="button" onClick={() => setActiveAction(null)} className="btn-ghost">Cancelar</button>
            <button type="button" onClick={confirmAction} disabled={saving} className="btn-primary" style={{ width: 'auto' }}>
              {saving ? 'Guardando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.buttonsRow}>
          <button type="button" onClick={() => openAction('aportar')} className={`${styles.actionBtn} ${!canContribute ? styles.actionBtnBlocked : ''}`}>
            <ArrowUp size={16} />
            Aportar
          </button>
          <button type="button" onClick={() => openAction('retirar')} className={`${styles.actionBtn} ${styles.actionBtnGhost} ${!canWithdraw ? styles.actionBtnBlocked : ''}`}>
            <ArrowDown size={16} />
            Retirar
          </button>
        </div>
      )}
      {isShared && !canWithdraw && !activeAction && (
        <div className={styles.blockedHint}>Retirar está desactivado — pídele el permiso al dueño del espacio.</div>
      )}

      {/* "Marcar como hecha" — solo para metas activas. Una meta ya
          cumplida se reabre desde el menú (arriba), no desde aquí, para
          no tener 2 formas de hacer lo mismo. Completar con dinero
          restante es automático, ver handleMarkComplete. */}
      {!goal.is_completed && (
        <button type="button" onClick={handleMarkComplete} disabled={completing} className={styles.completeButton}>
          <Check size={15} />
          {completing ? 'Completando...' : 'Marcar como hecha'}
        </button>
      )}

      <div className={styles.historyTitle}>Historial</div>
      {goal.transactions.length === 0 ? (
        <div className={styles.historyEmpty}>Todavía no hay movimientos en esta meta.</div>
      ) : (
        <div className={styles.historyList}>
          {goal.transactions.map(tx => {
            const isAporte = tx.type === 'aporte'
            const TxIcon = isAporte ? ArrowUpCircle : ArrowDownCircle
            // Revertir un aporte propio necesita el mismo permiso con el
            // que se aportó; el de alguien más necesita poder eliminar —
            // mismo criterio que ya usa el Fondo Compartido al borrar una
            // aportación.
            const isOwnTx = tx.user_id === currentUserId
            const canRevertThis = isShared && isAporte && (isOwnTx ? canContribute : canDelete)
            const authorName = isShared
              ? (isOwnTx ? 'Tú' : (spaceMembers.find(m => m.user_id === tx.user_id)?.profile?.name || 'Alguien'))
              : null
            return (
              <div key={tx.id} className={styles.historyRow}>
                <div className={styles.historyLeft}>
                  <TxIcon size={16} color={isAporte ? 'var(--paid)' : 'var(--soon-color)'} />
                  <span>
                    {authorName ? `${authorName} ${isAporte ? 'aportó' : 'retiró'}` : (isAporte ? 'Aporte' : 'Retiro')} · {fmtDate(tx.created_at)}
                  </span>
                </div>
                <div className={styles.historyRight}>
                  <span style={{ color: isAporte ? 'var(--paid)' : 'var(--soon-color)' }}>
                    {isAporte ? '+' : '-'}{fmt(tx.amount)}
                  </span>
                  {canRevertThis && (
                    <button type="button" onClick={() => handleRevert(tx)} className={styles.revertButton} aria-label="Revertir aporte">
                      <RotateCcw size={15} color="var(--text)" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <DeleteGoalModal
        open={deleteModalOpen}
        goal={goal}
        onCancel={() => setDeleteModalOpen(false)}
        onConfirm={resolution => { setDeleteModalOpen(false); onDelete(resolution) }}
      />
    </div>
  )
}
