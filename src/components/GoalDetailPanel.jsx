import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, MoreVertical, ArrowUp, ArrowDown, Check, ArrowUpCircle, ArrowDownCircle, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { getIconComponent } from '../lib/categoryIcons'
import { fmt, getMonthsShort } from '../lib/utils'
import { showToast } from './Toast'
import { DeleteGoalModal } from './DeleteGoalModal'
import AmountInput from './AmountInput'
import { PaymentMethodField } from './PaymentMethodField'
import { AddCardModal } from './AddCardModal'
import styles from './GoalDetailPanel.module.css'
import { useScrollLock } from '../lib/scrollLock'

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
  hasIncome = true, paymentMethods = null, desk = false,
}) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  useScrollLock(menuOpen)
  const [activeAction, setActiveAction] = useState(null) // null | 'aportar' | 'retirar'
  const [amount, setAmount] = useState('')
  // "Se paga con" al aportar (de dónde sale el dinero: efectivo o tarjeta).
  const [methodId, setMethodId] = useState(null)
  const [cardFormOpen, setCardFormOpen] = useState(false)
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
    setMethodId(null)
    setMenuOpen(false)
  }

  async function confirmAction() {
    const val = parseFloat(amount)
    if (!val || val <= 0) { showToast(t('goalDetailPanel.toast.invalidAmount')); return }
    if (activeAction === 'retirar' && val > goal.currentAmount) {
      showToast(t('goalDetailPanel.toast.exceedsDeposited', { amount: fmt(goal.currentAmount) }))
      return
    }
    const action = activeAction
    const successMsg = action === 'aportar' ? t('goalDetailPanel.toast.contributed') : t('goalDetailPanel.toast.withdrawn')
    const card = paymentMethods?.methods.find(m => m.id === methodId)
    const pending = action === 'aportar' ? onAportar(val, card ? { id: card.id, kind: card.kind } : null) : onRetirar(val)
    // Personal (v0.9.483): optimista — el panel cierra al instante y el
    // progreso ya se ve; el aviso de éxito sale al confirmar. Con
    // `reverted`/`busy` el aviso de error ya lo dio App.jsx.
    if (!isShared) {
      setActiveAction(null)
      pending.then(({ error, reverted, busy }) => {
        if (reverted || busy) return
        showToast(error ? (error.message || t('goalDetailPanel.toast.saveError')) : successMsg)
      })
      return
    }
    setSaving(true)
    const { error } = await pending
    setSaving(false)
    if (error) { showToast(error.message || t('goalDetailPanel.toast.saveError')); return }
    showToast(successMsg)
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
    // Personal (v0.9.483): optimista — sin estado de "completando"; la meta
    // ya se ve cumplida y el aviso sale al confirmar.
    if (!isShared) {
      const { error, reverted, busy } = await onMarkCompleted(true)
      if (reverted || busy) return
      if (error) { showToast(error.message || t('goalDetailPanel.toast.completeError')); return }
    } else {
      setCompleting(true)
      const { error } = await onMarkCompleted(true)
      setCompleting(false)
      if (error) { showToast(error.message || t('goalDetailPanel.toast.completeError')); return }
    }
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
    <div className={`${styles.screen} ${desk ? styles.desk : ''}`} style={desk ? { backgroundImage: `radial-gradient(70% 50% at 0% 0%, color-mix(in srgb, ${goal.color} 30%, transparent), transparent 70%)` } : undefined}>
      <div className={styles.header}>
        <button type="button" onClick={onBack} className={styles.iconButton} aria-label={t('goalDetailPanel.back')}>
          <ChevronLeft size={22} color="var(--text)" />
        </button>
        <div className={styles.headerIcon} style={{ background: goal.color }}>
          {Icon && <Icon size={15} color="var(--on-color)" />}
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

      <div className={styles.body}>
      <div className={styles.summaryCol}>
      {desk ? (
        <div className={styles.dHero}>
          <div className={styles.dTop}>
            <span>{t('goalDetailPanel.savedLabel')}</span>
            {!goal.is_completed && goal.target_date && <span className={goal.isOverdue ? styles.dLate : ''}>{goal.isOverdue ? t('goalsPage.card.overdue') : t('goalsPage.card.daysRemaining', { count: goal.daysRemaining })}</span>}
          </div>
          <div className={styles.dBig}>{fmt(goal.currentAmount).replace(/\.\d+$/, '')}<small>{fmt(goal.currentAmount).match(/\.\d+$/)?.[0] || ''}</small></div>
          <div className={styles.dOf}>{t('deskGoals.ofTarget', { amount: fmt(goal.target_amount), pct: (goal.is_completed ? 100 : goal.percent) })}</div>
          <div className={styles.dTrack}><u style={{ width: `${(goal.is_completed ? 100 : goal.percent)}%`, background: goal.color }} /></div>
          <div className={styles.dFoot}>
            <span>{t('goalsPage.card.remaining', { amount: fmt(goal.remaining) })}</span>
            <span>{t('goalDetailPanel.createdOn', { date: fmtDate(goal.created_at) })}</span>
          </div>
        </div>
      ) : (
      <>
      <div className={styles.ring} style={{ background: `conic-gradient(${desk ? 'var(--accent)' : 'var(--paid)'} 0% ${goal.percent}%, ${desk ? 'var(--desk-chip)' : 'var(--border)'} ${goal.percent}% 100%)` }}>
        <div className={styles.ringInner}>
          <div className={styles.ringPercent}>{goal.percent}%</div>
          <div className={styles.ringAmounts}>{fmt(goal.currentAmount)} / {fmt(goal.target_amount)}</div>
          <div className={styles.ringSub}>{t('goalDetailPanel.completedLabel')}</div>
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
      </>
      )}
      {goal.notes && <div className={styles.notes}>{goal.notes}</div>}

      {/* Desglose — solo tablet (en teléfono los montos van dentro del anillo) */}
      <div className={styles.statsList}>
        <div className={styles.statRow}><span>{t('goalDetailPanel.savedLabel')}</span><b className={styles.statSaved}>{fmt(goal.currentAmount)}</b></div>
        <div className={styles.statRow}><span>{t('goalDetailPanel.remainingLabel')}</span><b>{fmt(goal.remaining)}</b></div>
        <div className={styles.statRow}><span>{t('goalDetailPanel.targetLabel')}</span><b>{fmt(goal.target_amount)}</b></div>
      </div>

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
          {activeAction === 'aportar' && paymentMethods && (
            <div className={styles.methodField}>
              <PaymentMethodField
                methods={paymentMethods.methods}
                value={methodId}
                onChange={setMethodId}
                onAddCard={() => setCardFormOpen(true)}
                allowCredit={false}
              />
            </div>
          )}
          <div className={styles.actionButtons}>
            <button type="button" onClick={() => setActiveAction(null)} className="btn-ghost">{t('buttons.cancel')}</button>
            <button type="button" onClick={confirmAction} disabled={saving || !(parseFloat(amount) > 0) || (activeAction === 'retirar' && parseFloat(amount) > goal.currentAmount)} className={`btn-primary ${styles.confirmButton}`}>
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
          <button type="button" onClick={() => openAction('retirar')} disabled={!(goal.currentAmount > 0)} className={`${styles.actionBtn} ${styles.actionBtnGhost} ${!canWithdraw ? styles.actionBtnBlocked : ''} ${!(goal.currentAmount > 0) ? styles.actionBtnEmpty : ''}`}>
            <ArrowDown size={16} />
            {t('goalDetailPanel.withdraw')}
          </button>
        </div>
      )}
      {isShared && !canWithdraw && !activeAction && (
        <div className={styles.blockedHint}>{t('goalDetailPanel.withdrawBlockedHint')}</div>
      )}
      {!activeAction && !(goal.currentAmount > 0) && (
        <div className={styles.emptyWithdrawHint}>{t('goalDetailPanel.nothingToWithdraw')}</div>
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

      </div>

      <div className={styles.historyCol}>
      <div className={styles.historyHead}>
        <div className={styles.historyTitle}>{t('goalDetailPanel.historyTitle')}</div>
        {goal.transactions.length > 0 && (
          <span className={styles.historyCount}>{t('goalDetailPanel.movementsCount', { count: goal.transactions.length })}</span>
        )}
      </div>
      {goal.transactions.length === 0 ? (
        <>
          <div className={styles.historyEmpty}>{t('goalDetailPanel.historyEmpty')}</div>
          <div className={styles.historyEmptyBlock}>
            <div className={styles.historyEmptyIcon}><ArrowUpCircle size={24} color="var(--muted)" /></div>
            <div className={styles.historyEmptyTitle}>{t('goalDetailPanel.historyEmptyTitle')}</div>
            <div className={styles.historyEmptyHint}>{t('goalDetailPanel.historyEmptyHint')}</div>
            {!goal.is_completed && !activeAction && (
              <button type="button" onClick={() => openAction('aportar')} className={styles.firstContribution}>
                <ArrowUp size={16} />
                {t('goalDetailPanel.firstContribution')}
              </button>
            )}
          </div>
        </>
      ) : (
        <div className={`${styles.historyList} ${desk ? 'scroll-y' : ''}`}>
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
                  <span className={isAporte ? styles.txIn : styles.txOut}>
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
      </div>
      </div>

      <DeleteGoalModal
        open={deleteModalOpen}
        goal={goal}
        onCancel={() => setDeleteModalOpen(false)}
        onConfirm={resolution => { setDeleteModalOpen(false); onDelete(resolution) }}
      />
      {paymentMethods && (
        <AddCardModal
          open={cardFormOpen}
          onClose={() => setCardFormOpen(false)}
          paymentMethods={paymentMethods}
          onAdded={setMethodId}
          selectableKinds={['debit']}
        />
      )}
    </div>
  )
}
