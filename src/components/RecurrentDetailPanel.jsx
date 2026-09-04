import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, MoreVertical, Pencil, Pause, Play, Trash2, Check } from 'lucide-react'
import { getCategoryIcon } from '../lib/categoryIcons'
import { fmt, dateOf, getFrequencyLabel, getCategoryLabel, getCatColor, getMonthsShort } from '../lib/utils'
import styles from './RecurrentDetailPanel.module.css'

function fmtDateFull(value) {
  const d = new Date(value)
  return `${d.getDate()} ${getMonthsShort()[d.getMonth()]} ${d.getFullYear()}`
}

function fmtDateShort(value) {
  const d = dateOf(value)
  return `${d.getDate()} ${getMonthsShort()[d.getMonth()]}`
}

// Pantalla de detalle al tocar un master en RecurrentsPage — mismo patrón de
// navegación lista↔detalle que GoalDetailPanel.jsx (push dentro de la misma
// pestaña, sin carrocería de modal), pero SIN ninguna acción de dinero: esto
// no es una meta, es solo un resumen + historial de lo que ya se pagó.
// Confirmado con Johnatan vía mockup (Regla 8) antes de escribir este
// archivo — 2 rondas: la primera reutilizaba el grid de "plan de pagos" de
// InstallmentAbonarModal.jsx para parcialidades, pero se descartó porque
// parecía tocable/editable estando aquí en modo solo-lectura; la versión
// final refleja el mismo concepto (el monto por pago puede variar si hubo
// un abono distinto al de referencia) directo en los montos reales del
// historial, sin ningún control interactivo.
//
// `onEdit`/`onPause`/`onResume`/`onDelete` llegan YA atados al `master.id`
// por RecurrentsPage.jsx (mismo criterio que GoalDetailPanel recibe
// onAportar/onRetirar ya atados a la meta) — este componente no conoce ids.
export function RecurrentDetailPanel({
  master, payments, profile,
  canEdit = true, canDelete = true, blocked,
  onBack, onEdit, onPause, onResume, onDelete,
}) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const menuRef = useRef(null)

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

  // Defensivo: is_installment puede ser null en registros viejos (mismo
  // criterio que la lista de RecurrentsPage.jsx y el filtro de tipo).
  const isInstallment = master.is_installment || master.total_installments > 0
  const children = payments.filter(p => p.parent_id === master.id)
  // `|| p.is_postponed` (agosto 2026, Fase 2) — un pospuesto se sigue
  // viendo en el historial (con su etiqueta, ver el render más abajo),
  // igual que en HomePage.jsx/PaymentsPage.jsx — pero su monto se excluye
  // de `paidSum` (no cuenta como gasto real). `nextChild` SÍ lo excluye
  // por completo — ya se resolvió, no debe mostrarse como "el próximo".
  const paidChildren = children
    .filter(p => p.is_paid || p.is_postponed)
    .sort((a, b) => new Date(b.paid_at || b.postponed_at || b.due_date) - new Date(a.paid_at || a.postponed_at || a.due_date))
  const nextChild = children
    .filter(p => !p.is_paid && !p.is_postponed)
    .sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))[0] || null
  const paidCount = paidChildren.length

  const CatIcon  = getCategoryIcon(master.category, profile.category_icons)
  const catColor = getCatColor(master.category, profile.custom_categories, profile.category_colors)

  const totalInstallments = master.total_installments
  const percent = totalInstallments ? Math.round((paidCount / totalInstallments) * 100) : 0
  // Mismo fallback que InstallmentAbonarModal.jsx/abonarInstallment: si esta
  // parcialidad no tiene total_amount (viejas de antes de v0.9.193), se
  // calcula contra el monto de referencia × total de pagos.
  const totalAmount = master.total_amount != null ? Number(master.total_amount) : Number(master.amount) * totalInstallments
  // `.filter(p => !p.is_postponed)` — mismo criterio que toda la app: un
  // pospuesto aparece en el historial pero no debe sumar como gasto real.
  const paidSum = paidChildren.filter(p => !p.is_postponed).reduce((s, p) => s + Number(p.amount), 0)

  function handlePauseToggle() {
    setMenuOpen(false)
    if (!canEdit) { blocked(t(master.paused ? 'recurrentsPage.actionResume' : 'recurrentsPage.actionPause')); return }
    master.paused ? onResume() : onPause()
  }

  function handleDeleteClick() {
    setMenuOpen(false)
    if (!canDelete) { blocked(t('paymentsPage.actionDeletePayments')); return }
    setConfirmDelete(true)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button type="button" onClick={onBack} className={styles.iconButton} aria-label={t('goalDetailPanel.back')}>
          <ChevronLeft size={22} color="var(--text)" />
        </button>
        <div className={styles.headerIcon} style={{ background: catColor }}>
          {CatIcon ? <CatIcon size={15} color="var(--text)" strokeWidth={2} /> : <span className={styles.headerIconFallback} />}
        </div>
        <div className={styles.headerTitle}>{master.name}</div>
        <div className={styles.menuWrapper} ref={menuRef}>
          <button type="button" onClick={() => setMenuOpen(o => !o)} className={styles.iconButton} aria-label={t('goalDetailPanel.moreOptions')}>
            <MoreVertical size={20} color="var(--text)" />
          </button>
          {menuOpen && (
            <div className={styles.menu}>
              <button type="button" onClick={() => { setMenuOpen(false); onEdit() }} className={styles.menuItem}>
                <span><Pencil size={14} /></span>{t('buttons.edit')}
              </button>
              <button type="button" onClick={handlePauseToggle} className={styles.menuItem}>
                <span>{master.paused ? <Play size={14} /> : <Pause size={14} />}</span>
                {t(master.paused ? 'recurrentDetailPanel.menuResume' : 'recurrentDetailPanel.menuPause')}
              </button>
              <button type="button" onClick={handleDeleteClick} className={`${styles.menuItem} ${styles.menuItemDanger}`}>
                <span><Trash2 size={14} /></span>{t('buttons.delete')}
              </button>
            </div>
          )}
        </div>
      </div>

      {isInstallment ? (
        <>
          <div className={styles.ring} style={{ background: `conic-gradient(var(--accent) 0% ${percent}%, var(--border) ${percent}% 100%)` }}>
            <div className={styles.ringInner}>
              <div className={styles.ringPercent}>{paidCount}/{totalInstallments}</div>
              <div className={styles.ringSub}>{t('recurrentDetailPanel.paidSuffix')}</div>
            </div>
          </div>
          <div className={styles.subtext}>
            {t('recurrentDetailPanel.referenceAmount', { amount: fmt(master.amount) })} · {getFrequencyLabel(master.recur_freq)}
          </div>

          <div className={styles.statsRow}>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>{t('recurrentDetailPanel.paidLabel')}</div>
              <div className={styles.statValue}>{fmt(paidSum)} <span className={styles.statValueMuted}>/ {fmt(totalAmount)}</span></div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>{t('recurrentDetailPanel.nextLabel')}</div>
              {master.paused ? (
                <div className={styles.statValueMutedBig}>{t('recurrentsPage.paused')}</div>
              ) : nextChild ? (
                <div className={styles.statValueAccent}>{fmtDateShort(nextChild.due_date)}</div>
              ) : (
                <div className={styles.statValueMutedBig}>—</div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {!master.is_variable && <div className={styles.bigAmount}>{fmt(master.amount)}</div>}
          <div className={styles.subtext}>
            {getFrequencyLabel(master.recur_freq)} · {getCategoryLabel(master.category)}
            {master.is_variable && <span className={styles.variableBadge}>{t('paymentsPage.variable')}</span>}
          </div>

          <div className={styles.statsRow}>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>{t('recurrentDetailPanel.completedLabel')}</div>
              <div className={styles.statValue}>{paidCount}</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>{t('recurrentDetailPanel.nextLabel')}</div>
              {master.paused ? (
                <div className={styles.statValueMutedBig}>{t('recurrentsPage.paused')}</div>
              ) : nextChild ? (
                <div className={styles.statValueAccent}>{fmtDateShort(nextChild.due_date)}</div>
              ) : (
                <div className={styles.statValueMutedBig}>—</div>
              )}
            </div>
          </div>
        </>
      )}

      <div className={styles.historyTitle}>{t('goalDetailPanel.historyTitle')}</div>
      {paidChildren.length === 0 ? (
        <div className={styles.historyEmpty}>{t('recurrentDetailPanel.historyEmpty')}</div>
      ) : (
        <div className={styles.historyList}>
          {paidChildren.map(p => {
            const isAdjusted = isInstallment && !p.is_postponed && Number(p.amount) !== Number(master.amount)
            return (
              <div key={p.id} className={styles.historyRow}>
                <Check size={16} color={p.is_postponed ? 'var(--soon-color)' : 'var(--paid)'} className={styles.historyIcon} />
                <div className={styles.historyInfo}>
                  <div className={styles.historyDate}>
                    {isInstallment && p.current_installment ? `${t('recurrentDetailPanel.paymentNumber', { num: p.current_installment })} · ` : ''}
                    {fmtDateFull(p.paid_at || p.postponed_at || p.due_date)}
                  </div>
                  {/* Pospuesto (agosto 2026, Fase 2) — mismo criterio que
                      PaidCollapseItem en HomePage.jsx: reemplaza la nota de
                      ajuste por la etiqueta cuando aplica (nunca las 2 a la
                      vez — un pospuesto no puede tener isAdjusted, ver
                      arriba). */}
                  {p.is_postponed ? (
                    <div className={styles.historyNote}>{t('payCard.status.postponed')}</div>
                  ) : isAdjusted && (
                    <div className={styles.historyNote}>{t('recurrentDetailPanel.amountAdjusted')}</div>
                  )}
                </div>
                <div className={`${styles.historyAmount} ${p.is_postponed ? styles.historyAmountMuted : ''}`}>{fmt(p.amount)}</div>
              </div>
            )
          })}
        </div>
      )}

      {confirmDelete && (
        <div className={styles.deleteConfirmPanel}>
          <div className={styles.deleteConfirmText}>{t('recurrentsPage.deleteConfirm', { name: master.name })}</div>
          <div className={styles.deleteConfirmRow}>
            <button type="button" onClick={() => setConfirmDelete(false)} className={styles.deleteCancelButton}>{t('buttons.cancel')}</button>
            <button type="button" onClick={() => { setConfirmDelete(false); onDelete() }} className={styles.deleteConfirmButton}>{t('buttons.delete')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
