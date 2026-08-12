import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, MoreVertical, ArrowUp, ArrowDown, Check, ArrowUpCircle, ArrowDownCircle, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { getIconComponent } from '../lib/categoryIcons'
import { fmt, getMonthsShort } from '../lib/utils'
import { showToast } from './Toast'
import { DeleteGoalModal } from './DeleteGoalModal'
import AmountInput from './AmountInput'
import styles from './GoalDetailPanel.module.css'

function fmtDate(iso) {
  const d = new Date(iso)
  return `${d.getDate()} ${getMonthsShort()[d.getMonth()]} ${d.getFullYear()}`
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
  const { t } = useTranslation()
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
    if (type === 'aportar' && !canContribute) { showToast(t('goalDetailPanel.toast.noPermissionContribute')); return }
    if (type === 'retirar' && !canWithdraw) { showToast(t('goalDetailPanel.toast.noPermissionWithdraw')); return }
    setActiveAction(type)
    setAmount('')
    setMenuOpen(false)
  }

  async function confirmAction() {
    const val = parseFloat(amount)
    if (!val || val <= 0) { showToast(t('goalDetailPanel.toast.invalidAmount')); return }
    if (activeAction === 'retirar' && val > goal.currentAmount) {
      showToast(t('goalDetailPanel.toast.exceedsDeposited', { amount: fmt(goal.currentAmount) }))
      return
    }
    setSaving(true)
    const { error } = activeAction === 'aportar' ? await onAportar(val) : await onRetirar(val)
    setSaving(false)
    if (error) { showToast(error.message || t('goalDetailPanel.toast.saveError')); return }
    showToast(activeAction === 'aportar' ? t('goalDetailPanel.toast.contributed') : t('goalDetailPanel.toast.withdrawn'))
    setActiveAction(null)
  }

  async function handleRevert(tx) {
    const { error } = await onRevert(tx.id)
    if (error) { showToast(error.message || t('goalDetailPanel.toast.revertError')); return }
    showToast(t('goalDetailPanel.toast.reverted'))
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
    if (error) { showToast(error.message || t('goalDetailPanel.toast.completeError')); return }
    if (goalRemaining > 0) {
      showToast(
        hasIncome
          ? t('goalDetailPanel.toast.completedWithIncome', { amount: fmt(goalRemaining) })
          : t('goalDetailPanel.toast.completedNoIncome')
      )
    } else {
      showToast(t('goalDetailPanel.toast.completed'))
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button type="button" onClick={onBack} className={styles.iconButton} aria-label={t('goalDetailPanel.back')}>
          <ChevronLeft size={22} color="var(--text)" />
        </button>
        <div className={styles.headerIcon} style={{ background: goal.color }}>
          {Icon && <Icon size={15} color="#fff" />}
        </div>
        <div className={styles.headerTitle}>{goal.name}</div>
        {showMenu && (
          <div className={styles.menuWrapper} ref={menuRef}>
            <button type="button" onClick={() => setMenuOpen(o => !o)} className={styles.iconButton} aria-label={t('goalDetailPanel.moreOptions')}>
              <MoreVertical size={20} color="var(--text)" />
            </button>
            {menuOpen && (
              <div className={styles.menu}>
                {goal.is_completed ? (
                  canEdit && (
                    <button type="button" onClick={() => { setMenuOpen(false); onMarkCompleted(false) }} className={styles.menuItem}>
                      <span><RotateCcw size={14} /></span>{t('goalDetailPanel.reopen')}
                    </button>
                  )
                ) : (
                  canEdit && (
                    <button type="button" onClick={() => { setMenuOpen(false); onEdit() }} className={styles.menuItem}>
                      <span><Pencil size={14} /></span>{t('buttons.edit')}
                    </button>
                  )
                )}
                {canDelete && (
                  <button type="button" onClick={() => { setMenuOpen(false); setDeleteModalOpen(true) }} className={`${styles.menuItem} ${styles.menuItemDanger}`}>
                    <span><Trash2 size={14} /></span>{t('buttons.delete')}
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
            {goal.isOverdue ? t('goalsPage.card.overdue') : t('goalsPage.card.daysRemaining', { count: goal.daysRemaining })}
          </span>
        )}
      </div>
      <div className={styles.createdAt}>{t('goalDetailPanel.createdOn', { date: fmtDate(goal.created_at) })}</div>
      {goal.notes && <div className={styles.notes}>{goal.notes}</div>}

      {activeAction ? (
        <div className={styles.actionForm}>
          <label className="field-label">{activeAction === 'aportar' ? t('goalDetailPanel.amountToContribute') : t('goalDetailPanel.amountToWithdraw')}</label>
          <AmountInput
            autoFocus
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            onKeyDown={e => e.key === 'Enter' && confirmAction()}
            className={`field-input ${styles.actionInput}`}
          />
          <div className={styles.actionButtons}>
            <button type="button" onClick={() => setActiveAction(null)} className="btn-ghost">{t('buttons.cancel')}</button>
            <button type="button" onClick={confirmAction} disabled={saving} className="btn-primary" style={{ width: 'auto' }}>
              {saving ? t('goalDetailPanel.saving') : t('goalDetailPanel.confirm')}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.buttonsRow}>
          <button type="button" onClick={() => openAction('aportar')} className={`${styles.actionBtn} ${!canContribute ? styles.actionBtnBlocked : ''}`}>
            <ArrowUp size={16} />
            {t('goalDetailPanel.contribute')}
          </button>
          <button type="button" onClick={() => openAction('retirar')} className={`${styles.actionBtn} ${styles.actionBtnGhost} ${!canWithdraw ? styles.actionBtnBlocked : ''}`}>
            <ArrowDown size={16} />
            {t('goalDetailPanel.withdraw')}
          </button>
        </div>
      )}
      {isShared && !canWithdraw && !activeAction && (
        <div className={styles.blockedHint}>{t('goalDetailPanel.withdrawBlockedHint')}</div>
      )}

      {/* "Marcar como hecha" — solo para metas activas. Una meta ya
          cumplida se reabre desde el menú (arriba), no desde aquí, para
          no tener 2 formas de hacer lo mismo. Completar con dinero
          restante es automático, ver handleMarkComplete. */}
      {!goal.is_completed && (
        <button type="button" onClick={handleMarkComplete} disabled={completing} className={styles.completeButton}>
          <Check size={15} />
          {completing ? t('goalDetailPanel.completing') : t('goalDetailPanel.markComplete')}
        </button>
      )}

      <div className={styles.historyTitle}>{t('goalDetailPanel.historyTitle')}</div>
      {goal.transactions.length === 0 ? (
        <div className={styles.historyEmpty}>{t('goalDetailPanel.historyEmpty')}</div>
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
              ? (isOwnTx ? t('goalDetailPanel.you') : (spaceMembers.find(m => m.user_id === tx.user_id)?.profile?.name || t('goalDetailPanel.someone')))
              : null
            return (
              <div key={tx.id} className={styles.historyRow}>
                <div className={styles.historyLeft}>
                  <TxIcon size={16} color={isAporte ? 'var(--paid)' : 'var(--soon-color)'} />
                  <span>
                    {authorName ? `${authorName} ${isAporte ? t('goalDetailPanel.contributedVerb') : t('goalDetailPanel.withdrewVerb')}` : (isAporte ? t('goalDetailPanel.contributionLabel') : t('goalDetailPanel.withdrawalLabel'))} · {fmtDate(tx.created_at)}
                  </span>
                </div>
                <div className={styles.historyRight}>
                  <span style={{ color: isAporte ? 'var(--paid)' : 'var(--soon-color)' }}>
                    {isAporte ? '+' : '-'}{fmt(tx.amount)}
                  </span>
                  {canRevertThis && (
                    <button type="button" onClick={() => handleRevert(tx)} className={styles.revertButton} aria-label={t('goalDetailPanel.revertAria')}>
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
