import { useTranslation } from 'react-i18next'
import { MousePointer2, Check, Pencil, Trash2, RotateCcw, Eye, DollarSign } from 'lucide-react'
import { EmptyState } from './EmptyState'
import { PaidByStack } from './PaidByStack'
import { fmt, dateOf, getMonthsShort, getCategoryLabel, getFrequencyLabel, getCatColor } from '../lib/utils'
import { getCategoryIcon } from '../lib/categoryIcons'
import { showToast } from './Toast'
import styles from './PayDetailPanel.module.css'

/**
 * Columna derecha del maestro-detalle de Home en tablet/desktop (Regla 45).
 * Vista de SOLO LECTURA del pago seleccionado + acciones rápidas — nunca
 * abre el formulario de edición inline (eso quedó descartado a propósito:
 * "Editar" sigue abriendo el `PaymentModal` de siempre, vía `onEdit`, sin
 * tocar cómo se guarda un pago en `App.jsx`).
 *
 * Sin `payment` seleccionado: estado vacío PROPIO y pasivo (Regla 46) —
 * reutiliza `EmptyState.jsx` tal cual, sin `onClick`, para no duplicar la
 * misma invitación de "agregar" que ya vive en la columna maestro.
 */
export function PayDetailPanel({ payment, profile, permissions, spaceMembers, onMarkPaid, onRequestVariableAmount, onConfirmVariablePaid, onCaptureAmount, onMarkUnpaid, onEdit, onDelete, onViewSource }) {
  const { t } = useTranslation()

  if (!payment) {
    return (
      <div className={styles.panelRoot}>
        <EmptyState
          icon={MousePointer2}
          title={t('payDetailPanel.emptyTitle')}
          subtitle={t('payDetailPanel.emptySubtitle')}
        />
      </div>
    )
  }

  const p = payment
  const canMarkPaid = !permissions || permissions.can_mark_paid
  const canEdit     = !permissions || permissions.can_edit
  const canDelete   = !permissions || permissions.can_delete
  function blocked(action) { showToast(t('paymentsPage.blockedAction', { action })) }

  const isReflection   = p.is_contribution_reflection
  const isPending      = !p.is_paid && !p.postponed && !p.is_postponed && !p.paused
  const needsAmount    = isPending && p.is_variable && !p.amount
  const catColor       = getCatColor(p.category, profile?.custom_categories || [], profile?.category_colors)
  const CatIcon         = getCategoryIcon(p.category, profile?.category_icons)
  const d               = dateOf(p.due_date)
  const registradoTotal = Number(p.contributed_amount || 0) + Number(p.fund_amount || 0)

  // Mismo criterio que PayCard.jsx (handleMarkPaidClick): un pago variable
  // siempre pasa por onRequestVariableAmount antes de confirmarse — sin la
  // animación de llenado propia de la card, ya que este es un panel
  // estático, no una fila de lista.
  async function handleMarkPaid() {
    if (!canMarkPaid) { blocked(t('paymentsPage.actionMarkPayments')); return }
    if (p.is_variable) {
      const amount = await onRequestVariableAmount(p)
      if (amount != null) onConfirmVariablePaid(p, amount)
    } else {
      onMarkPaid(p)
    }
  }

  return (
    <div className={styles.panelRoot}>
      <div className={styles.categorySquare} style={{ background: catColor }}>
        {CatIcon
          ? <CatIcon size={20} color="var(--text)" strokeWidth={2} />
          : <span className={styles.categoryDot} />
        }
      </div>

      <div className={styles.name}>{p.name}</div>
      <div className={styles.amount}>{fmt(p.amount)}</div>

      {p.is_paid && (
        <div className={styles.paidBadge}>
          <Check size={13} strokeWidth={3} />
          {t('payCard.status.paid')}
        </div>
      )}

      {p.space_id && !p.is_paid && registradoTotal > 0 && (
        <div className={styles.progressRow}>
          <span className={styles.progressText}>{fmt(registradoTotal)} / {fmt(p.amount)}</span>
          <PaidByStack contributors={p.contributors} members={spaceMembers} fundAmount={p.fund_amount || 0} size={18} />
        </div>
      )}

      <div className={styles.fieldsList}>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>{t('paymentModal.fields.category')}</span>
          <span className={styles.fieldValue}>{getCategoryLabel(p.category)}</span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>{p.is_paid ? t('payDetailPanel.paidOn') : t('paymentModal.dueDate')}</span>
          <span className={styles.fieldValue}>{d.getDate()} {getMonthsShort()[d.getMonth()]}</span>
        </div>
        {p.is_recurrent && p.recur_freq && (
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>{t('payDetailPanel.frequency')}</span>
            <span className={styles.fieldValue}>{getFrequencyLabel(p.recur_freq)}</span>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        {isReflection ? (
          <button onClick={() => onViewSource && onViewSource(p)} className="btn-primary">
            <Eye size={16} /> {t('homePage.viewInSharedSpace')}
          </button>
        ) : p.is_paid ? (
          <button
            onClick={() => canMarkPaid ? onMarkUnpaid(p.id) : blocked(t('paymentsPage.actionMarkPayments'))}
            className={`btn-ghost ${styles.ghostAction}`}
            style={{ opacity: canMarkPaid ? 1 : 0.5 }}
          >
            <RotateCcw size={16} /> {t('payCard.menu.markUnpaid')}
          </button>
        ) : (
          <>
            {isPending && (
              needsAmount ? (
                <button onClick={() => onCaptureAmount && onCaptureAmount(p)} className="btn-primary">
                  <DollarSign size={16} /> {t('payCard.addAmount')}
                </button>
              ) : (
                <button onClick={handleMarkPaid} className="btn-primary" style={{ opacity: canMarkPaid ? 1 : 0.5 }}>
                  <Check size={16} /> {t('payCard.markPaidAriaLabel')}
                </button>
              )
            )}
            <button onClick={() => onEdit(p)} className={`btn-ghost ${styles.ghostAction}`}>
              <Pencil size={16} /> {t('buttons.edit')}
            </button>
            <button
              onClick={() => canDelete ? onDelete(p.id, p) : blocked(t('paymentsPage.actionDeletePayments'))}
              className="btn-danger"
              style={{ opacity: canDelete ? 1 : 0.5 }}
            >
              <Trash2 size={16} /> {t('buttons.delete')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
