import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { Wallet, AlertTriangle, Repeat, Check } from 'lucide-react'
import { CATEGORIES, RECUR_FREQ, WEEKDAYS_SHORT, getWeekdaysShort, MONTHS, getMonths, MONTHS_SHORT, getMonthsShort, intlLocale, nextWeekdayDate, nextBiweeklyFromDate, nextPeriodDate, cobroPeriod, fmt, nameExistsActive, projectPeriodImpact, getCatColor, getCategoryLabel, dateToStr, todayStr } from '../lib/utils'
import { getCategoryIcon } from '../lib/categoryIcons'
import { supabase } from '../lib/supabase'
import { ConfirmCloseModal } from './ConfirmCloseModal'
import { FrequencyPicker } from './FrequencyPicker'
import { PremiumLock } from './PremiumLock'
import { Select } from './Select'
import { DatePicker } from './DatePicker'
import styles from './PaymentModal.module.css'

export function PaymentModal({ open, onClose, onSave, onSaveInstallment, onDelete, initial, payments, profile, spacePermissions, isSharedSpace = false, customCategories = [], onAddCategory, onOpenPremium }) {
  const { t } = useTranslation()
  const [mode,               setMode]               = useState('single')
  const [name,               setName]               = useState('')
  const [amount,             setAmount]             = useState('')
  const [dueDate,            setDueDate]            = useState('')
  const [category,           setCategory]           = useState('Servicios')
  const [isVariable,         setIsVariable]         = useState(false)
  const [recurFreq,          setRecurFreq]          = useState('monthly')
  const [weekday,            setWeekday]            = useState(5)
  const [biweeklyDate,       setBiweeklyDate]       = useState('')
  const [totalInstallments,  setTotalInstallments]  = useState('')
  const [startFrom,          setStartFrom]          = useState('1')
  const [totalAmount,        setTotalAmount]        = useState('')
  const [saving,             setSaving]             = useState(false)
  const [error,              setError]              = useState('')
  const [confirmClose,       setConfirmClose]       = useState(false)
  const [alreadyPaid,        setAlreadyPaid]        = useState(false)
  const [paidAt,             setPaidAt]             = useState('')
  const [addingCategory,     setAddingCategory]     = useState(false)
  const [newCategoryName,    setNewCategoryName]    = useState('')
  const [periodIncomes,      setPeriodIncomes]      = useState([])

  const isEditingInstallment = !!(initial?.is_installment)

  // Crear (sin `initial`) necesita can_add; editar cualquier campo (con
  // `initial`, incluyendo editar parcialidades) necesita can_edit — mismo
  // criterio que ya quedó aplicado en el trigger de la base de datos
  // (v0.9.132). `can_delete` es independiente: se puede tener uno sin el
  // otro (ej. editar pagos pero no poder eliminarlos).
  const canWrite  = !spacePermissions || (initial ? spacePermissions.can_edit : spacePermissions.can_add)
  const canDelete = !spacePermissions || spacePermissions.can_delete
  const lockedMessage = !canWrite
    ? t('paymentsPage.blockedAction', { action: initial ? t('paymentsPage.actionEditPayments') : t('paymentsPage.actionAddPayments') })
    : null

  useEffect(() => {
    if (open) document.body.classList.add('modal-open')
    else      document.body.classList.remove('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [open])

  const dirtyRef = useRef(false)
  useEffect(() => {
    dirtyRef.current = initial ? true : (name.trim() !== '' || amount !== '' || totalInstallments !== '')
  }, [initial, name, amount, totalInstallments])

  // Simulador — ingresos extra del periodo actual (period_income), para que
  // "Impacto en tus finanzas" refleje lo mismo que el remanente real de la
  // app cuando el pago cae en el periodo actual (ver `projectPeriodImpact`).
  // Solo lectura, solo cuando se está creando un pago nuevo.
  useEffect(() => {
    if (!open || initial || !profile) { setPeriodIncomes([]); return }
    let cancelled = false
    async function loadPeriodIncomes() {
      const { start } = cobroPeriod(profile)
      const periodStartStr = dateToStr(start)
      const { data } = await supabase
        .from('period_income')
        .select('amount')
        .eq('period_start', periodStartStr)
      if (!cancelled) setPeriodIncomes(data || [])
    }
    loadPeriodIncomes()
    return () => { cancelled = true }
  }, [open, initial, profile])

  useEffect(() => {
    if (!open) return
    if (initial) {
      setName(initial.name || '')
      setAmount(initial.amount || '')
      setDueDate(initial.due_date || todayStr())
      setBiweeklyDate(initial.due_date || todayStr())
      setCategory(initial.category || 'Servicios')
      setIsVariable(initial.is_variable || false)
      setRecurFreq(initial.recur_freq || 'monthly')
      setMode(initial.is_installment ? 'installment' : initial.is_recurrent ? 'recurrent' : 'single')
      setTotalInstallments(initial.total_installments || '')
      setStartFrom('1')
      setAlreadyPaid(!!initial.is_paid)
      setPaidAt(initial.paid_at ? dateToStr(new Date(initial.paid_at)) : todayStr())
    } else {
      setName(''); setAmount('')
      setDueDate(todayStr())
      setBiweeklyDate(todayStr())
      setCategory('Servicios'); setIsVariable(false)
      setRecurFreq('monthly'); setWeekday(5)
      setMode('single'); setTotalInstallments(''); setStartFrom('1'); setTotalAmount('')
      setAlreadyPaid(false)
      setPaidAt('')
    }
    setError(''); setConfirmClose(false); setAddingCategory(false); setNewCategoryName('')
  }, [initial, open])

  useEffect(() => {
    if (!open) return
    const handler = () => {
      if (dirtyRef.current) setConfirmClose(true)
      else onClose()
    }
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [open])

  function hasDirty() {
    if (initial) return true
    return name.trim() !== '' || amount !== '' || totalInstallments !== ''
  }
  function requestClose() { if (hasDirty()) { setConfirmClose(true); return }; onClose() }

  const monthBasedFreqs = ['monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual']

  async function handleSave() {
    if (!canWrite) return
    setError('')
    if (!name.trim()) { setError(t('paymentModal.nameError')); return }
    const checkName = initial?.name || null
    if (nameExistsActive(payments || [], name, checkName)) {
      setError(t('paymentModal.duplicateNameError', { name: name.trim() })); return
    }
    if (mode === 'installment') {
      const totalAmt = parseFloat(totalAmount)
      if (!totalAmount || isNaN(totalAmt) || totalAmt <= 0) { setError(t('paymentModal.installment.totalAmountError')); return }
      if (!totalInstallments || isNaN(parseInt(totalInstallments))) { setError(t('paymentModal.installment.countError')); return }
      const total = parseInt(totalInstallments)
      if (total < 2) { setError(t('paymentModal.installment.minError')); return }
      const start = parseInt(startFrom) || 1
      if (start > total) { setError(t('paymentModal.installment.startExceedsTotal')); return }
      if (!dueDate) { setError(t('paymentModal.installment.firstDateError')); return }
      const amountPerPayment = Math.round((totalAmt / total) * 100) / 100
      setSaving(true)
      await onSaveInstallment({ name: name.trim(), amount: amountPerPayment, totalAmount: totalAmt, totalInstallments: total, startFrom: start, recurFreq, category, firstDate: dueDate })
      setSaving(false); onClose(); return
    }
    if (!isVariable && (!amount || isNaN(parseFloat(amount)))) { setError(t('paymentModal.amountOrVariableError')); return }
    let finalDate = dueDate
    if (mode === 'recurrent' && recurFreq === 'weekly')    finalDate = dateToStr(nextWeekdayDate(weekday))
    if (mode === 'recurrent' && recurFreq === 'biweekly')  finalDate = biweeklyDate ? dateToStr(nextBiweeklyFromDate(biweeklyDate)) : dueDate
    if (!finalDate) { setError(t('paymentModal.dueDateError')); return }
    setSaving(true)
    const payload = {
      name: name.trim(),
      amount: isVariable ? 0 : parseFloat(amount),
      due_date: finalDate,
      category,
      is_variable: isVariable,
      is_recurrent: mode === 'recurrent',
      recur_freq: mode === 'recurrent' ? recurFreq : null,
      is_installment: false,
    }
    // Solo tocar is_paid/paid_at cuando corresponde:
    // - Pago nuevo: refleja el toggle "Ya lo pagué"
    // - Edición de un pago que YA estaba pagado: se mantiene pagado y se respeta la fecha editada
    // - Edición de un pago pendiente (o de un master): no se incluyen estas llaves, así el update no las toca
    if (!initial) {
      payload.is_paid = alreadyPaid
      payload.paid_at = alreadyPaid ? new Date().toISOString() : null
    } else if (initial.is_paid) {
      payload.is_paid = true
      payload.paid_at = paidAt ? new Date(paidAt + 'T12:00:00').toISOString() : initial.paid_at
    }
    await onSave(payload)
    setSaving(false); onClose()
  }

  // Las fijas van como {value, label}: value es el canónico en español que
  // se guarda siempre (getCatColor/getCategoryIcon/CATEGORIES siguen
  // funcionando igual, comparan contra ese mismo valor); label es el
  // nombre traducido que ve el usuario, vía getCategoryLabel() de
  // lib/utils.js. Las personalizadas se quedan como string plano — son el
  // texto que el usuario mismo escribió, no hay nada que traducir (mismo
  // criterio ya aplicado en SettingsCategoriesPage.jsx). Select.jsx ya
  // soporta ambos formatos mezclados en el mismo arreglo.
  const allCategories = [...CATEGORIES.map(c => ({ value: c, label: getCategoryLabel(c) })), ...customCategories]

  // Ícono + color de cada categoría, mismo criterio que "Por Categoría" en
  // PaymentsPage.jsx — cuadro de color con el ícono elegido por el usuario
  // (o el punto de color si no tiene ícono asignado), sin barra ni monto.
  function renderCategoryIcon(cat) {
    const catColor = getCatColor(cat, customCategories, profile?.category_colors)
    const CatIcon   = getCategoryIcon(cat, profile?.category_icons)
    return (
      <div className={styles.categoryIconSquare} style={{ background: catColor }}>
        {CatIcon
          ? <CatIcon size={13} color="var(--text)" strokeWidth={2} />
          : <span className={styles.categoryIconFallbackDot} />
        }
      </div>
    )
  }

  async function handleAddCategory() {
    const cat = newCategoryName.trim()
    if (!cat) return
    if (onAddCategory) await onAddCategory(cat)
    setCategory(cat)
    setAddingCategory(false)
    setNewCategoryName('')
  }

  if (!open) return null

  const showDatePicker     = mode === 'single' || mode === 'installment' || (mode === 'recurrent' && monthBasedFreqs.includes(recurFreq))
  const showWeekdayPicker  = mode === 'recurrent' && recurFreq === 'weekly'
  const showBiweeklyPicker = mode === 'recurrent' && recurFreq === 'biweekly'
  const nextBiDate         = biweeklyDate ? nextBiweeklyFromDate(biweeklyDate) : null

  // Simulador — impacto en el periodo actual y el siguiente. Solo aplica a
  // pagos nuevos (no ediciones) de tipo único o recurrente con monto fijo.
  // NOTA: función de prueba, sin gate de premium por ahora (ver CONTEXT.md).
  const previewDueDate =
    mode === 'recurrent' && recurFreq === 'weekly'   ? dateToStr(nextWeekdayDate(weekday)) :
    mode === 'recurrent' && recurFreq === 'biweekly' ? (biweeklyDate ? dateToStr(nextBiweeklyFromDate(biweeklyDate)) : dueDate) :
    dueDate

  const showImpactPreview = !initial && !!profile && mode !== 'installment' && !isVariable && !alreadyPaid && !isSharedSpace
    && !!amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && !!previewDueDate

  const impactPreview = showImpactPreview
    ? projectPeriodImpact(payments || [], profile, {
        dueDate: previewDueDate,
        amount: parseFloat(amount),
        isRecurring: mode === 'recurrent',
        recurFreq,
      }, periodIncomes)
    : null

  if (isEditingInstallment) {
    async function handleEditInstallment() {
      if (!canWrite) return
      setError('')
      if (!name.trim()) { setError(t('paymentModal.nameError')); return }
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) { setError(t('paymentModal.editInstallment.amountError')); return }
      const total = parseInt(totalInstallments)
      if (!total || total < initial.current_installment) {
        setError(t('paymentModal.editInstallment.totalBelowCurrentError', { current: initial.current_installment })); return
      }
      if (!dueDate) { setError(t('paymentModal.editInstallment.nextDateError')); return }
      setSaving(true)
      await onSave({
        name: name.trim(),
        amount: parseFloat(amount),
        total_installments: total,
        category,
        recur_freq: recurFreq,
        due_date: dueDate,
      })
      setSaving(false); onClose()
    }

    return (
      <>
        <div onClick={e => e.target === e.currentTarget && onClose()} className={styles.overlay}>
          <div className={styles.panel}>
            <div className={styles.handle} />

            {/* Contexto */}
            <div className={styles.installmentHeaderRow}>
              <div className={styles.installmentHeaderTitle}>{t('paymentModal.editInstallment.title')}</div>
              <div className={styles.installmentBadge}>
                {t('paymentModal.editInstallment.badge', { current: initial.current_installment, total: initial.total_installments })}
              </div>
            </div>

            {error && <div className={styles.errorBox}>{error}</div>}
            {lockedMessage && <div className={styles.warningBox}>{lockedMessage}</div>}

            <div className={canWrite ? styles.formWrapper : styles.formDisabled}>
            <Field label={t('paymentModal.fields.name')}>
              <input className="field-input" type="text" value={name} onChange={e => setName(e.target.value)} />
            </Field>

            <div className={styles.fieldGroup}>
              <div className={styles.categoryHeaderRow}>
                <label className="field-label">{t('paymentModal.fields.category')}</label>
                <button type="button" onClick={() => { setAddingCategory(true); setNewCategoryName('') }}
                  className={styles.addCategoryButton}>
                  {t('paymentModal.fields.addCategory')}
                </button>
              </div>
              <Select value={category} onChange={setCategory} options={allCategories} renderIcon={renderCategoryIcon} />
              {addingCategory && (
                <div className={styles.addCategoryRow}>
                  <input autoFocus className={`field-input ${styles.addCategoryInput}`} placeholder={t('paymentModal.fields.categoryNamePlaceholder')} value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && newCategoryName.trim()) handleAddCategory(); if (e.key === 'Escape') setAddingCategory(false) }} />
                  <button type="button" onClick={handleAddCategory} disabled={!newCategoryName.trim()}
                    className={styles.addCategorySubmitButton}>
                    {t('paymentModal.fields.add')}
                  </button>
                </div>
              )}
            </div>

            <Field label={t('paymentModal.fields.amountPerPayment')}>
              <input className="field-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </Field>

            <Field label={t('paymentModal.fields.totalPayments')}>
              <input className="field-input" type="number" value={totalInstallments} onChange={e => setTotalInstallments(e.target.value)} placeholder={t('paymentModal.fields.totalPaymentsPlaceholder')} min={initial.current_installment} />
              <div className={styles.helperText}>
                {(() => {
                  const remaining = Math.max(0, parseInt(totalInstallments) - initial.current_installment + 1)
                  return isNaN(remaining) ? '—' : t('paymentModal.editInstallment.remainingHelper', { count: remaining })
                })()}
              </div>
            </Field>

            <FrequencyPicker value={recurFreq} onChange={setRecurFreq} />

            <Field label={t('paymentModal.fields.nextPaymentDate')}>
              <DatePicker value={dueDate} onChange={setDueDate} />
            </Field>
            </div>

            <button onClick={handleEditInstallment} disabled={saving || !canWrite} className={`btn-primary ${styles.saveButtonSpacing}`} style={{ opacity: (saving || !canWrite) ? 0.7 : 1 }}>
              {saving ? t('settingsCategories.saving') : t('paymentModal.editInstallment.saveButton')}
            </button>
            <button onClick={onClose} className={`btn-ghost ${styles.cancelButtonSpacing}`}>{t('buttons.cancel')}</button>
            <button onClick={() => { onDelete(initial.id, initial); onClose() }} disabled={!canDelete} className={`btn-danger ${styles.deleteButtonSpacing}`} style={{ opacity: canDelete ? 1 : 0.5 }}>
              {t('paymentModal.editInstallment.cancelInstallments')}
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div onClick={e => e.target === e.currentTarget && requestClose()} className={styles.overlay}>
        <div className={styles.panel}>
          <div className={styles.handle} />

          {!initial && (
            <div data-coachmark="modal-payment-type-tabs" className={styles.paymentTypeTabs}>
              {[['single',t('paymentModal.tabs.single')],['recurrent',t('paymentModal.tabs.recurrent')],['installment',t('paymentModal.tabs.installment')]].map(([m, label]) => (
                <button key={m} onClick={() => setMode(m)} className={`${styles.paymentTypeTab} ${mode === m ? styles.paymentTypeTabActive : ''}`}>{label}</button>
              ))}
            </div>
          )}

          <div className={styles.modalTitle}>
            {initial?.is_master && initial?.paused ? t('paymentModal.title.reactivate') : initial?.is_master ? t('paymentModal.title.editRecurrent') : initial ? t('paymentModal.title.edit') : mode === 'installment' ? t('paymentModal.title.installment') : mode === 'recurrent' ? t('paymentModal.title.recurrent') : t('paymentModal.title.new')}
          </div>

          {mode === 'installment' && !initial && (
            <div className={styles.infoBanner}>
              {t('paymentModal.installmentInfoBanner')}
            </div>
          )}

          {error && <div className={styles.errorBox}>{error}</div>}
          {lockedMessage && <div className={styles.warningBox}>{lockedMessage}</div>}

          <div className={canWrite ? styles.formWrapper : styles.formDisabled}>
          <Field label={t('paymentModal.fields.name')}>
            <input autoFocus={!initial} className="field-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t('paymentModal.namePlaceholder')} />
          </Field>

          <div className={styles.fieldGroup}>
            <div className={styles.categoryHeaderRow}>
              <label className="field-label">{t('paymentModal.fields.category')}</label>
              <button type="button" onClick={() => { setAddingCategory(true); setNewCategoryName('') }}
                className={styles.addCategoryButton}>
                {t('paymentModal.fields.addCategory')}
              </button>
            </div>
            <div data-coachmark="modal-category-field">
              <Select value={category} onChange={setCategory} options={allCategories} renderIcon={renderCategoryIcon} />
            </div>
            {addingCategory && (
              <div className={styles.addCategoryRow}>
                <input autoFocus className={`field-input ${styles.addCategoryInput}`} placeholder={t('paymentModal.fields.categoryNamePlaceholder')} value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newCategoryName.trim()) handleAddCategory(); if (e.key === 'Escape') setAddingCategory(false) }} />
                <button type="button" onClick={handleAddCategory} disabled={!newCategoryName.trim()}
                  className={styles.addCategorySubmitButton}>
                  {t('paymentModal.fields.add')}
                </button>
              </div>
            )}
          </div>

          {mode !== 'installment' && (
            <div data-coachmark="modal-variable-toggle">
              <Toggle label={t('paymentModal.variableToggleLabel')} sub={t('paymentModal.variableToggleSub')} value={isVariable} onChange={setIsVariable} />
            </div>
          )}

          {!isVariable && mode !== 'installment' && (
            <Field label={t('paymentModal.amountLabel')}>
              <input className="field-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </Field>
          )}

          {mode === 'installment' && (() => {
            const totalAmt    = parseFloat(totalAmount) || 0
            const numPayments = parseInt(totalInstallments) || 0
            const perPayment  = numPayments > 0 ? Math.round((totalAmt / numPayments) * 100) / 100 : 0
            const startNum    = parseInt(startFrom) || 1
            const firstDateStr = dueDate  // parcialidades siempre usan fecha fija (date picker)
            // El usuario ingresa la fecha del pago #1. Si startFrom > 1,
            // el primer pago pendiente estará (startFrom - 1) periodos después.
            let nextDate = firstDateStr ? new Date(firstDateStr + 'T12:00:00') : null
            if (nextDate && startNum > 1 && firstDateStr) {
              let dateStr = firstDateStr
              for (let i = 1; i < startNum; i++) {
                dateStr = dateToStr(nextPeriodDate(dateStr, recurFreq))
              }
              nextDate = new Date(dateStr + 'T12:00:00')
            }
            return (
              <>
                <Field label={t('paymentModal.totalAmountToPay')}>
                  <input className="field-input" type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} placeholder={t('paymentModal.totalAmountPlaceholder')} min="0" enterKeyHint="next" />
                </Field>
                <Field label={t('paymentModal.numPayments')}>
                  <input className="field-input" type="number" value={totalInstallments} onChange={e => setTotalInstallments(e.target.value)} placeholder={t('paymentModal.numPaymentsPlaceholder')} min="2" enterKeyHint="next" />
                </Field>
                <Field label={t('paymentModal.startFromLabel')}>
                  <input className="field-input" type="number" value={startFrom} onChange={e => setStartFrom(e.target.value)} placeholder="1" min="1" enterKeyHint="next" />
                  {startNum > 1 && <div className={styles.helperText}>{t('paymentModal.autoMarkedHelper', { n: startNum - 1 })}</div>}
                </Field>
                {totalAmt > 0 && numPayments >= 2 && (
                  <div className={styles.summaryBox}>
                    <div className={styles.summaryTitle}>{t('paymentModal.summary.title')}</div>
                    <div className={styles.summaryText}>
                      {t('paymentModal.summary.willPay')} <strong>{t('paymentModal.summary.paymentsOf', { count: numPayments, amount: perPayment.toLocaleString('es-MX') })}</strong>, {t('paymentModal.summary.every')}{' '}
                      {t(`paymentModal.summary.frequency.${recurFreq}`)}.
                      {nextDate && (
                        <> {t('paymentModal.summary.nextPayment', { day: nextDate.getDate(), month: i18n.language === 'en' ? getMonths()[nextDate.getMonth()] : getMonths()[nextDate.getMonth()].toLowerCase() })}.</>
                      )}
                      {startNum > 1 && (
                        <> {t('paymentModal.summary.remainingTotal', { amount: ((numPayments - startNum + 1) * perPayment).toLocaleString('es-MX') })}.</>
                      )}
                    </div>
                  </div>
                )}
              </>
            )
          })()}

          {(mode === 'recurrent' || mode === 'installment') && (
            <FrequencyPicker value={recurFreq} onChange={setRecurFreq} />
          )}

          {showDatePicker && (
            <div className={styles.fieldGroup}>
              <div className={styles.categoryHeaderRow}>
                <label className={`field-label ${styles.dueDateLabelNoMargin}`}>
                  {mode === 'installment' ? t('paymentModal.firstPaymentDate') : t('paymentModal.dueDate')}
                </label>
                {mode === 'single' && !initial && !isVariable && !isSharedSpace && (
                  <div onClick={() => setAlreadyPaid(v => !v)}
                    className={styles.alreadyPaidToggle}>
                    <span className={styles.alreadyPaidLabel} style={{ color: alreadyPaid ? 'var(--paid)' : 'var(--text)' }}>
                      {t('paymentModal.alreadyPaidToggle')}
                    </span>
                    <div className="toggle-track" style={{ background: alreadyPaid ? 'var(--paid)' : 'var(--border)' }}>
                      <div className="toggle-thumb" style={{ left: alreadyPaid ? 19 : 3 }} />
                    </div>
                  </div>
                )}
              </div>
              <DatePicker value={dueDate} onChange={setDueDate} />
            </div>
          )}

          {mode === 'single' && initial && initial.is_paid && (
            <Field label={t('paymentModal.paidDateLabel')}>
              <DatePicker value={paidAt} onChange={setPaidAt} />
            </Field>
          )}

          {showWeekdayPicker && (
            <Field label={t('paymentModal.dueDayLabel')}>
              <div className={styles.weekdayRow}>
                {getWeekdaysShort().map((d, i) => (
                  <button key={i} onClick={() => setWeekday(i)} className={`${styles.weekdayButton} ${weekday === i ? styles.weekdayButtonActive : ''}`}>{d}</button>
                ))}
              </div>
              <div className={styles.helperTextMt6}>
                {t('paymentModal.nextLabel', { date: nextWeekdayDate(weekday).toLocaleDateString(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' }) })}
              </div>
            </Field>
          )}

          {showBiweeklyPicker && (
            <Field label={t('paymentModal.biweeklyBaseDateLabel')}>
              <DatePicker value={biweeklyDate} onChange={setBiweeklyDate} />
              {nextBiDate && <div className={styles.helperTextMt6}>{t('paymentModal.nextDueLabel', { date: nextBiDate.toLocaleDateString(intlLocale(), { day: 'numeric', month: 'long' }) })}</div>}
            </Field>
          )}

          {mode === 'recurrent' && (
            <div className={styles.recurrentNote}>
              {t('paymentModal.recurrentNote', { interval: t(`paymentModal.recurrentIntervals.${recurFreq === 'weekly' ? 'weekly' : recurFreq === 'biweekly' ? 'biweekly' : 'monthly'}`) })}
            </div>
          )}
          </div>

          {impactPreview && impactPreview.length > 0 && (() => {
            const [first, second] = impactPreview
            const esNegativo = first.disponibleDespues < 0
            const colorEstado = esNegativo ? 'var(--impact-warning)' : 'var(--accent)'

            return (
              <PremiumLock
                isPremium={profile?.is_premium}
                label={t('paymentModal.impact.label')}
                icon={Wallet}
                message={t('paymentModal.impact.message')}
                onUpgradeClick={onOpenPremium}
              >
              <div className={styles.impactWrapper}>
                <div className={styles.impactLabel}>
                  <Wallet size={14} />
                  {t('paymentModal.impact.label')}
                </div>
                <div className={styles.impactCard}>
                  <div className={styles.impactPeriodBox} style={{ borderColor: colorEstado }}>
                    <div className={styles.impactStatusRow}>
                      {esNegativo ? <AlertTriangle size={15} color={colorEstado} className={styles.impactStatusIcon} /> : <Check size={15} color={colorEstado} className={styles.impactStatusIcon} />}
                      <div className={styles.impactStatusText} style={{ color: colorEstado }}>
                        <div>{esNegativo ? t('paymentModal.impact.warning') : t('paymentModal.impact.ok')}</div>
                        <div>{t('paymentModal.impact.periodLabel', { range: rangeLabel(first.start, first.end) })}</div>
                      </div>
                    </div>
                    <div className={styles.impactAmount} style={{ color: colorEstado }}>
                      {fmt(first.disponibleDespues)}
                    </div>
                    <div className={styles.impactDetails}>
                      <div>{t('paymentModal.impact.currentlyAvailable', { amount: fmt(first.disponibleAntes) })}</div>
                      {(first.pendientesCount > 0 || first.variablesPendientes > 0) && (
                        <div>
                          {first.pendientesCount > 0 && t('paymentModal.impact.pendingCount', { count: first.pendientesCount, amount: fmt(first.pendientesMonto) })}
                          {first.pendientesCount > 0 && first.variablesPendientes > 0 && ' + '}
                          {first.variablesPendientes > 0 && t('paymentModal.impact.variableCount', { count: first.variablesPendientes })}
                        </div>
                      )}
                    </div>
                  </div>

                  {second && (
                    <div className={styles.impactSecondPeriod}>
                      <div className={styles.impactSecondRow}>
                        <div className={styles.impactSecondLeft}>
                          <Repeat size={13} color="var(--text)" className={styles.impactSecondIcon} />
                          <div className={styles.impactSecondText}>
                            <div>{t('paymentModal.impact.nextPeriodAvailable')}</div>
                            <div>{rangeLabel(second.start, second.end)}.</div>
                          </div>
                        </div>
                        <span className={styles.impactSecondAmount}>{fmt(second.disponibleDespues)} MXN</span>
                      </div>
                      {(second.pendientesCount > 0 || second.variablesPendientes > 0) && (
                        <div className={styles.impactSecondDetails}>
                          {second.pendientesCount > 0 && t('paymentModal.impact.pendingCount', { count: second.pendientesCount, amount: fmt(second.pendientesMonto) })}
                          {second.pendientesCount > 0 && second.variablesPendientes > 0 && ' + '}
                          {second.variablesPendientes > 0 && t('paymentModal.impact.variableCountUncounted', { count: second.variablesPendientes })}
                        </div>
                      )}
                    </div>
                  )}

                  {!profile.salary_enabled && (
                    <div className={styles.impactSalaryHint}>
                      {t('paymentModal.impact.salaryHint')}
                    </div>
                  )}
                </div>
              </div>
              </PremiumLock>
            )
          })()}

          <button onClick={handleSave} disabled={saving || !canWrite} className={`btn-primary ${styles.saveButtonSpacing}`} style={{ opacity: (saving || !canWrite) ? 0.7 : 1 }}>
            {saving ? t('settingsCategories.saving') : initial?.is_master && initial?.paused ? t('paymentModal.save.reactivate') : initial ? t('paymentModal.save.saveChanges') : mode === 'installment' ? t('paymentModal.save.createPayments') : alreadyPaid ? t('paymentModal.save.saveAsPaid') : t('paymentModal.save.savePayment')}
          </button>
          <button onClick={requestClose} className={`btn-ghost ${styles.cancelButtonSpacing}`}>{t('buttons.cancel')}</button>
          {initial && !isEditingInstallment && (
            <button onClick={() => { onDelete(initial.id); onClose() }} disabled={!canDelete} className={`btn-danger ${styles.deleteButtonSpacing}`} style={{ opacity: canDelete ? 1 : 0.5 }}>{t('paymentModal.deletePayment')}</button>
          )}
        </div>
      </div>
      <ConfirmCloseModal open={confirmClose} onConfirm={() => { setConfirmClose(false); onClose() }} onCancel={() => setConfirmClose(false)} />
    </>
  )
}

function rangeLabel(start, end) {
  const monthsShort = getMonthsShort()
  const sameMonth = start.getMonth() === end.getMonth()
  if (sameMonth) return `${start.getDate()}–${end.getDate()} ${monthsShort[end.getMonth()]}`
  return `${start.getDate()} ${monthsShort[start.getMonth()]} – ${end.getDate()} ${monthsShort[end.getMonth()]}`
}

function Field({ label, children }) {
  return (
    <div className={styles.fieldGroup}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ label, sub, value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} className={styles.toggleWrapper}>
      <div>
        <div className={styles.toggleLabel}>{label}</div>
        <div className={styles.toggleSub}>{sub}</div>
      </div>
      <div className="toggle-track" style={{ background: value ? 'var(--accent)' : 'var(--border)' }}>
        <div className="toggle-thumb" style={{ left: value ? 19 : 3 }} />
      </div>
    </div>
  )
}
