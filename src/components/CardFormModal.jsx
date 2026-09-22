import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { BANKS, NETWORKS, bankColorVar } from '../lib/cardCatalog'
import { CreditCardVisual } from './CreditCardVisual'
import { CardNetworkIcon } from './CardNetworkIcon'
import { CardDayRangePicker } from './CardDayRangePicker'
import { Select } from './Select'
import { SegmentedControl as Segmented } from './SegmentedControl'
import styles from './CardFormModal.module.css'

// Alta/edición de una tarjeta (v0.9.486, mockups confirmados con Johnatan).
// Arriba, la tarjeta en vivo: cambia de color con el banco, muestra alias,
// últimos 4, red y chip/"Digital" mientras se llenan los campos.
// Entrada y salida animadas (Regla 29) — mismo patrón que GoalFormModal:
// `entering`/`closing` como clases temporales; ANIM_MS debe coincidir con
// las duraciones de CardFormModal.module.css (Regla 30).
const ANIM_MS = 320

const EMPTY = { kind: 'credit', bank: null, alias: '', last4: '', network: 'visa', form: 'physical', cut_day: null, due_day: null }

export function CardFormModal({ open, initial, onSave, onClose }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')

  const [closing, setClosing] = useState(false)
  const [entering, setEntering] = useState(false)
  const wasOpenRef = useRef(open)
  const closeTimerRef = useRef(null)
  const enterTimerRef = useRef(null)
  useEffect(() => () => { clearTimeout(closeTimerRef.current); clearTimeout(enterTimerRef.current) }, [])
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
    if (!open) return
    setForm(initial ? {
      kind: initial.kind, bank: initial.bank, alias: initial.alias || '', last4: initial.last4 || '',
      network: initial.network, form: initial.form, cut_day: initial.cut_day, due_day: initial.due_day,
    } : EMPTY)
    setError('')
  }, [open, initial])

  const showModal = open || closing || wasOpenRef.current
  if (!showModal) return null

  const set = patch => { setForm(f => ({ ...f, ...patch })); setError('') }
  const isCredit = form.kind === 'credit'

  function handleSave() {
    if (!form.bank) { setError(t('cards.errors.bank')); return }
    if (isCredit && (!form.cut_day || !form.due_day)) { setError(t('cards.errors.days')); return }
    if (isCredit && form.cut_day === form.due_day) { setError(t('cards.picker.sameDay')); return }
    if (form.last4 && !/^\d{4}$/.test(form.last4)) { setError(t('cards.errors.last4')); return }
    onSave(form)
  }

  const groupLabels = {
    banks: t('cards.bankGroups.banks'),
    digital: t('cards.bankGroups.digital'),
    stores: t('cards.bankGroups.stores'),
    other: t('cards.bankGroups.other'),
  }
  const bankOptions = BANKS.map(b => ({ value: b.id, label: b.id === 'otro' ? t('cards.otherBank') : b.name, group: b.group }))

  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()} className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`}>
      <div className={`${styles.modal} ${entering ? styles.modalEntering : ''} ${closing ? styles.modalClosing : ''}`}>
        <div className={styles.handle} />
        <div className={styles.title}>{initial ? t('cards.form.titleEdit') : t('cards.form.titleNew')}</div>

        <div className={styles.fieldGroup}>
          <Segmented
            value={form.kind}
            disabled={!!initial}
            onChange={kind => set({ kind })}
            options={[
              { value: 'credit', label: t('cards.kind.credit') },
              { value: 'debit', label: t('cards.kind.debit') },
            ]}
          />
          {initial && <div className={styles.helper}>{t('cards.form.kindLocked')}</div>}
        </div>

        <div className={styles.preview}>
          <CreditCardVisual card={{ ...form, bank: form.bank || 'otro' }} />
        </div>

        <div className={styles.fieldGroup}>
          <label className="field-label">{t('cards.form.bank')}</label>
          <Select
            value={form.bank}
            onChange={bank => set({ bank })}
            options={bankOptions}
            placeholder={t('cards.form.bankPlaceholder')}
            searchable
            groupLabels={groupLabels}
            renderIcon={id => <span className={styles.bankDot} style={{ '--bank-dot': bankColorVar(id) }} />}
          />
        </div>

        <div className={styles.row2}>
          <div className={styles.fieldGrow}>
            <label className="field-label">{t('cards.form.alias')}</label>
            <input
              className="field-input"
              value={form.alias}
              maxLength={24}
              onChange={e => set({ alias: e.target.value })}
              placeholder={t('cards.form.aliasPlaceholder')}
            />
          </div>
          <div className={styles.fieldLast4}>
            <label className="field-label">{t('cards.form.last4')}</label>
            <input
              className="field-input"
              inputMode="numeric"
              value={form.last4}
              onChange={e => set({ last4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              placeholder="0000"
            />
          </div>
        </div>
        <div className={styles.helperTight}>{t('cards.form.aliasHelper')}</div>

        <div className={styles.fieldGroup}>
          <label className="field-label">{t('cards.form.network')}</label>
          <Segmented
            value={form.network}
            onChange={network => set({ network })}
            options={NETWORKS.map(n => ({
              value: n,
              label: t(`cards.network.${n}`),
              icon: <CardNetworkIcon network={n} size={16} className={styles.segIcon} />,
            }))}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className="field-label">{t('cards.form.form')}</label>
          <Segmented
            value={form.form}
            onChange={f => set({ form: f })}
            options={[
              { value: 'physical', label: t('cards.form.physical') },
              { value: 'digital', label: t('cards.form.digital') },
            ]}
          />
        </div>

        {isCredit ? (
          <div className={`${styles.fieldGroup} ${styles.daysBlock}`}>
            <label className="field-label">{t('cards.form.days')}</label>
            <CardDayRangePicker
              cutDay={form.cut_day}
              dueDay={form.due_day}
              onChange={days => set(days)}
            />
          </div>
        ) : (
          <div className={`${styles.helper} ${styles.daysBlock}`}>{t('cards.form.debitNote')}</div>
        )}

        {error && <div className={styles.errorText}>{error}</div>}

        <button type="button" onClick={handleSave} className="btn-primary">
          {initial ? t('cards.form.saveEdit') : t('cards.form.saveNew')}
        </button>
        <button type="button" onClick={onClose} className={`btn-ghost ${styles.cancel}`}>{t('buttons.cancel')}</button>
      </div>
    </div>,
    document.body
  )
}
