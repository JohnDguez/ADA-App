import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { MoreVertical, Pencil, Check, Trash2, ChevronRight, Repeat } from 'lucide-react'
import { fmt, dateOf, getMonths, getMonthsShort, getCategoryLabel } from '../lib/utils'
import { groupByMonth, usesRecurring } from '../lib/scheduled'
import styles from './ScheduledList.module.css'

// Lista de «Programados» (v0.9.1055): pagos únicos pendientes con fecha futura,
// agrupados por mes. La usan Gastos de escritorio/tablet (chip «Programados») y
// el móvil (tercera pestaña). Cada fila trae su menú ⋮ (editar, marcar como
// pagado, eliminar) y, al final, un atajo a Recurrentes — o, si la persona solo
// registra pagos únicos, un consejo que abre Nuevo pago ya como recurrente.
export function ScheduledList({ rows, payments, mobile = false, onEdit, onMarkPaid, onDelete, onGoRecurrents, onAddRecurrent, canEdit = true }) {
  const { t } = useTranslation()
  const [menuId, setMenuId] = useState(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!menuId) return
    const close = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuId(null) }
    const esc = e => { if (e.key === 'Escape') setMenuId(null) }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      document.removeEventListener('keydown', esc)
    }
  }, [menuId])

  const groups = groupByMonth(rows, 'due_date')
  const months = getMonths()
  const short = getMonthsShort()
  const act = fn => p => { setMenuId(null); fn?.(p) }

  return (
    <div className={`${styles.root} ${mobile ? styles.mobile : ''}`} ref={wrapRef}>
      {groups.map(g => (
        <section key={g.key} className={styles.group}>
          <header className={styles.gh}>
            <b>{months[g.month]} {g.year}</b>
            <small>{t('categoryHistory.monthSummary', { count: g.items.length, total: fmt(g.total).replace(/\.\d+$/, '') })}</small>
          </header>
          <div className={styles.card}>
            {g.items.map(p => {
              const d = dateOf(p.due_date)
              return (
                <div key={p.id} className={styles.row}>
                  <div className={styles.date}><s>{short[d.getMonth()]}</s><b>{d.getDate()}</b></div>
                  <div className={styles.info}>
                    <b title={p.name}>{p.name}</b>
                    <span>{getCategoryLabel(p.category)}</span>
                  </div>
                  <div className={styles.amount}>{fmt(p.amount).replace(/\.\d+$/, '')}</div>
                  <div className={styles.menuWrap}>
                    <button type="button" className={styles.menuBtn} aria-label={t('scheduled.menuAria')} aria-expanded={menuId === p.id}
                      onClick={e => { e.stopPropagation(); setMenuId(menuId === p.id ? null : p.id) }}>
                      <MoreVertical size={16} strokeWidth={1.8} />
                    </button>
                    {menuId === p.id && (
                      <div className={styles.menu} role="menu">
                        <button type="button" role="menuitem" onClick={() => act(onEdit)(p)}><Pencil size={14} />{t('scheduled.menuEdit')}</button>
                        <button type="button" role="menuitem" onClick={() => act(onMarkPaid)(p)}><Check size={14} />{t('scheduled.menuMarkPaid')}</button>
                        <button type="button" role="menuitem" className={styles.danger} onClick={() => act(onDelete)(p)}><Trash2 size={14} />{t('scheduled.menuDelete')}</button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {usesRecurring(payments) ? (
        <button type="button" className={styles.link} onClick={onGoRecurrents}>
          <span>{t('scheduled.recurringLinkText')}</span>
          <em>{t('scheduled.recurringLinkAction')}<ChevronRight size={14} strokeWidth={2.2} /></em>
        </button>
      ) : (
        <div className={styles.tip}>
          <Repeat size={18} strokeWidth={1.9} />
          <p>{t('scheduled.tipText')}</p>
          {canEdit && <button type="button" onClick={onAddRecurrent}>{t('scheduled.tipAction')}</button>}
        </div>
      )}
    </div>
  )
}
