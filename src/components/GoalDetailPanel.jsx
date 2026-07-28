import { useState } from 'react'
import { ChevronLeft, MoreVertical, ArrowUp, ArrowDown, Check, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { getIconComponent } from '../lib/categoryIcons'
import { fmt, MONTHS_SHORT } from '../lib/utils'
import { showToast } from './Toast'
import { DeleteGoalModal } from './DeleteGoalModal'
import styles from './GoalDetailPanel.module.css'

function fmtDate(iso) {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

export function GoalDetailPanel({ goal, onBack, onEdit, onAportar, onRetirar, onMarkCompleted, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeAction, setActiveAction] = useState(null) // null | 'aportar' | 'retirar'
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  const Icon = getIconComponent(goal.icon)

  function openAction(type) {
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
        <div className={styles.menuWrapper}>
          <button type="button" onClick={() => setMenuOpen(o => !o)} className={styles.iconButton} aria-label="Más opciones">
            <MoreVertical size={20} color="var(--muted)" />
          </button>
          {menuOpen && (
            <div className={styles.menu}>
              <button type="button" onClick={() => { setMenuOpen(false); onEdit() }} className={styles.menuItem}>Editar</button>
              <button type="button" onClick={() => { setMenuOpen(false); setDeleteModalOpen(true) }} className={`${styles.menuItem} ${styles.menuItemDanger}`}>Eliminar</button>
            </div>
          )}
        </div>
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
          <button type="button" onClick={() => openAction('aportar')} className={styles.actionBtn}>
            <ArrowUp size={16} />
            Aportar
          </button>
          <button type="button" onClick={() => openAction('retirar')} className={`${styles.actionBtn} ${styles.actionBtnGhost}`}>
            <ArrowDown size={16} />
            Retirar
          </button>
        </div>
      )}

      <button type="button" onClick={() => onMarkCompleted(!goal.is_completed)} className={styles.completeButton}>
        <Check size={15} />
        {goal.is_completed ? 'Marcar como pendiente' : 'Marcar como hecha'}
      </button>

      <div className={styles.historyTitle}>Historial</div>
      {goal.transactions.length === 0 ? (
        <div className={styles.historyEmpty}>Todavía no hay movimientos en esta meta.</div>
      ) : (
        <div className={styles.historyList}>
          {goal.transactions.map(tx => {
            const isAporte = tx.type === 'aporte'
            const TxIcon = isAporte ? ArrowUpCircle : ArrowDownCircle
            return (
              <div key={tx.id} className={styles.historyRow}>
                <div className={styles.historyLeft}>
                  <TxIcon size={16} color={isAporte ? 'var(--paid)' : 'var(--soon-color)'} />
                  <span>{isAporte ? 'Aporte' : 'Retiro'} · {fmtDate(tx.created_at)}</span>
                </div>
                <span style={{ color: isAporte ? 'var(--paid)' : 'var(--soon-color)' }}>
                  {isAporte ? '+' : '-'}{fmt(tx.amount)}
                </span>
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
