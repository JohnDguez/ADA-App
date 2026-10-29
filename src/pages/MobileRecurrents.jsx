import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, ChevronDown, MoreVertical, Loader2, CreditCard } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { ChipMenu } from '../components/ChipMenu'
import { Bone, CategoryAccordionSkeleton } from '../components/SkeletonLoader'
import { fmt, getFrequencyLabel, getCatColor, getCategoryLabel, monthlyEquivalent, dateOf, getMonthsShort } from '../lib/utils'
import { getCategoryIcon } from '../lib/categoryIcons'
import { kbd } from '../lib/a11y'
import styles from './MobileRecurrents.module.css'

// Gastos recurrentes móvil (<768px, v0.9.907) — diseño aprobado con mockup.
// La lógica, el detalle y los modales siguen en RecurrentsPage.jsx: aquí solo
// se pinta lo que llega en `d` (mismo objeto que usa la versión de escritorio).
// Fila según la Regla 55; medidas en rem/clamp (Regla 54).

const whole = v => fmt(v).replace(/\.00$/, '')

function Money({ text }) {
  const i = text.lastIndexOf('.')
  return i < 0 ? text : <>{text.slice(0, i)}<small>{text.slice(i)}</small></>
}

export function MobileRecurrents({ d }) {
  const { t } = useTranslation()
  const {
    profile, dataLoading, onAdd, search, setSearch, filterStatus, setFilterStatus, filterType, setFilterType, byCategory,
    totals, installments, getNextDue, setSelectedMasterId, onDelete, openMenu, setOpenMenu, confirmDelete, setConfirmDelete,
  } = d
  const [open, setOpen] = useState({})   // todas cerradas al entrar
  const isInst = m => m.is_installment || m.total_installments > 0
  const short = getMonthsShort()

  function openRowMenu(e, m) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const openUpward = rect.bottom + 140 > window.innerHeight - 90
    setOpenMenu(openMenu?.id === m.id ? null : {
      id: m.id,
      top: openUpward ? undefined : rect.bottom + 4,
      bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
      right: window.innerWidth - rect.right,
    })
  }

  const typeOptions = [
    ['todos', t('recurrentsPage.filters.all')],
    ['recurrentes', t('recurrentsPage.filters.recurrent')],
    ['parcialidades', t('recurrentsPage.filters.installments')],
  ].map(([value, label]) => ({ value, label }))
  const typeLabel = typeOptions.find(o => o.value === filterType)?.label

  return (
    <div className={styles.root}>
      <label className={styles.search}>
        <Search size={16} strokeWidth={1.9} />
        <input aria-label={t('recurrentsPage.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} placeholder={t('recurrentsPage.searchPlaceholder')} />
      </label>

      <section data-coachmark="recurrentes-stats" className={styles.card}>
        <div className={styles.label}>{t('recurrentsPage.monthlySum')}</div>
        <div className={styles.bigNum}>{dataLoading ? <Bone w={150} h={36} r={8} /> : <>≈<Money text={fmt(totals.monthly)} /></>}</div>
        <div className={styles.sub}>{t('recurrentsPage.monthlyPaymentsLabel')}</div>
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <span>{t('recurrentsPage.activeLabel')}</span>
            <b>{dataLoading ? '…' : totals.active}</b>
            <em>{dataLoading ? '' : t('recurrentsPage.pausedCount', { count: totals.paused })}</em>
          </div>
          <div className={styles.tile}>
            <span>{t('deskRecurrents.installmentsLabel')}</span>
            <b>{dataLoading ? '…' : installments.count}</b>
            <em>{dataLoading ? '' : installments.count > 0 ? t('recurrentsPage.remainingPayments', { count: installments.left }) : t('deskRecurrents.noInstallments')}</em>
          </div>
        </div>
      </section>

      <div className={styles.filterRow} data-coachmark="recurrentes-filtro-tipo">
        <div className={styles.chips}>
          {[['todos', t('recurrentsPage.filters.all')], ['activos', t('recurrentsPage.filters.active')], ['pausados', t('recurrentsPage.filters.paused')]].map(([v, l]) => (
            <button key={v} type="button" aria-pressed={filterStatus === v} className={`${styles.chip} ${filterStatus === v ? styles.chipOn : ''}`} onClick={() => setFilterStatus(v)}>{l}</button>
          ))}
        </div>
        <ChipMenu className={`${styles.chip} ${styles.chipType} ${filterType !== 'todos' ? styles.chipOn : ''}`} value={filterType} onChange={setFilterType}
          options={typeOptions} label={filterType === 'todos' ? t('mobileRecurrents.typeShort') : typeLabel} ariaLabel={t('mobileRecurrents.typeAria')} />
      </div>

      {dataLoading ? (
        <CategoryAccordionSkeleton count={3} />
      ) : byCategory.length === 0 ? (
        search ? (
          <div className={styles.noResults}><CreditCard size={32} strokeWidth={1.6} /><span>{t('recurrentsPage.noResultsForSearch')}</span></div>
        ) : (
          <EmptyState title={t('recurrentsPage.noRecurrentsTitle')} subtitle={t('homePage.emptyState.subtitle')} onClick={onAdd} />
        )
      ) : byCategory.map(([cat, list], gi) => {
        const isOpen = !!open[cat]
        const catTotal = list.reduce((s, m) => s + monthlyEquivalent(m), 0)
        const CatIcon = getCategoryIcon(cat, profile.category_icons)
        return (
          <div key={cat} className={styles.group} style={{ '--i': gi }}>
            <button type="button" className={styles.gh} aria-expanded={isOpen} onClick={() => setOpen(o => ({ ...o, [cat]: !o[cat] }))}>
              <i className={styles.catChip} style={{ background: getCatColor(cat, profile.custom_categories, profile.category_colors) }}>{CatIcon && <CatIcon size={18} color="var(--on-color)" strokeWidth={2} />}</i>
              <span className={styles.gt}>
                <b>{getCategoryLabel(cat)}</b>
                <span>{t('recurrentsPage.paymentCount', { count: list.length })}{catTotal > 0 && ` · ≈ ${whole(catTotal)}${t('recurrentsPage.perMonthSuffix')}`}</span>
              </span>
              <ChevronDown size={18} className={`${styles.chev} ${isOpen ? styles.chevOpen : ''}`} />
            </button>
            <div className={`${styles.body} ${isOpen ? styles.bodyOpen : ''}`} inert={!isOpen}>
              <div className={styles.bodyInner}>
                {list.map(m => {
                  const next = getNextDue(m.id)
                  const when = !m.paused && next ? dateOf(next.due_date) : null
                  const support = [
                    m.paused ? t('recurrentsPage.paused') : null,
                    getFrequencyLabel(m.recur_freq),
                    isInst(m) && next ? t('mobileRecurrents.installmentShort', { current: next.current_installment, total: m.total_installments }) : null,
                  ].filter(Boolean).join(' · ')
                  return (
                    <div key={m.id}>
                      <div {...kbd} data-payment-id={m.id} onClick={() => setSelectedMasterId(m.id)} className={`${styles.row} ${m.paused ? styles.rowPaused : ''}`}>
                        <div className={styles.date}>{when ? <><s>{short[when.getMonth()]}</s><b>{when.getDate()}</b></> : <b>—</b>}</div>
                        <div className={styles.info}>
                          <b>{m.name}</b>
                          <span>{support}</span>
                        </div>
                        {m.is_variable
                          ? <span className={styles.varText}>{t('paymentsPage.variable')}</span>
                          : <span className={styles.amount}>{whole(m.amount)}</span>}
                        {m._syncing ? (
                          <button type="button" disabled className={styles.menuBtn} aria-label={t('sync.syncing')}><span className="sync-spinner"><Loader2 size={16} strokeWidth={1.8} /></span></button>
                        ) : (
                          <button type="button" className={styles.menuBtn} aria-label={t('recurrentsPage.menuAriaLabel')} onClick={e => openRowMenu(e, m)}><MoreVertical size={16} strokeWidth={1.8} /></button>
                        )}
                      </div>
                      {confirmDelete === m.id && (
                        <div className={styles.confirm}>
                          <span>{t('recurrentsPage.deleteConfirm', { name: m.name })}</span>
                          <div>
                            <button type="button" className={styles.cancelBtn} onClick={() => setConfirmDelete(null)}>{t('buttons.cancel')}</button>
                            <button type="button" className={styles.dangerBtn} onClick={() => { onDelete && onDelete(m.id, m); setConfirmDelete(null) }}>{t('buttons.delete')}</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
