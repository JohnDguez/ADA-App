import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Check } from 'lucide-react'
import { CATEGORY_ICON_GROUPS, getIconComponent } from '../lib/categoryIcons'
import { DatePicker } from './DatePicker'
import AmountInput from './AmountInput'
import styles from './GoalFormModal.module.css'

const PALETTE = Array.from({ length: 16 }, (_, i) => `var(--palette-${i + 1})`)
const ANIM_MS = 320

// Crear y editar una meta comparten el mismo formulario — `initial` viene
// null para crear, o el objeto de la meta para editar (mismo criterio que
// el resto de modales de edición de la app, ej. PaymentModal).
export function GoalFormModal({ open, initial, onSave, onClose }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [icon, setIcon] = useState('PiggyBank')
  const [color, setColor] = useState(PALETTE[0])
  const [targetAmount, setTargetAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [iconSearch, setIconSearch] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

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
    setName(initial?.name || '')
    setNotes(initial?.notes || '')
    setIcon(initial?.icon || 'PiggyBank')
    setColor(initial?.color || PALETTE[0])
    setTargetAmount(initial?.target_amount != null ? String(initial.target_amount) : '')
    setTargetDate(initial?.target_date || '')
    setIconSearch('')
    setError('')
  }, [open, initial])

  // `wasOpenRef.current` cubre el frame que hay entre que `open` pasa a
  // false y que el efecto de arriba alcanza a marcar `closing` (los
  // efectos corren DESPUÉS del render). Sin él, en ese frame `showModal`
  // daba false, el componente devolvía null y el DOM se destruía para
  // volver a crearse al render siguiente — eso reiniciaba la animación
  // (parpadeo en desktop) y re-montaba el input de nombre, así que su
  // `autoFocus` se disparaba otra vez y abría el teclado en celular justo
  // antes de cerrar. Bug reportado por Johnatan.
  const showModal = open || closing || wasOpenRef.current
  if (!showModal) return null

  async function handleSave() {
    if (!name.trim()) { setError(t('goalFormModal.errors.emptyName')); return }
    const amountVal = parseFloat(targetAmount)
    if (!amountVal || amountVal <= 0) { setError(t('goalFormModal.errors.invalidAmount')); return }
    setSaving(true)
    await onSave({ name, notes, icon, color, targetAmount: amountVal, targetDate: targetDate || null })
    setSaving(false)
  }

  const search = iconSearch.trim().toLowerCase()
  const filteredGroups = CATEGORY_ICON_GROUPS
    .map(g => ({ ...g, icons: search ? g.icons.filter(i => i.label.toLowerCase().includes(search)) : g.icons }))
    .filter(g => g.icons.length > 0)

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`}>
      <div className={`${styles.modal} ${entering ? styles.modalEntering : ''} ${closing ? styles.modalClosing : ''}`}>
        <div className={styles.handle} />
        <div className={styles.title}>{initial ? t('goalFormModal.titleEdit') : t('goalFormModal.titleNew')}</div>

        <div className={styles.fieldGroup}>
          <label className="field-label">{t('goalFormModal.nameLabel')}</label>
          <input
            autoFocus
            className={`field-input ${styles.inputMt}`}
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            placeholder={t('goalFormModal.namePlaceholder')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className="field-label">{t('goalFormModal.notesLabel')}</label>
          <textarea
            className={`field-input ${styles.inputMt} ${styles.textarea}`}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={t('goalFormModal.notesPlaceholder')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className="field-label">{t('goalFormModal.iconColorLabel')}</label>
          <div className={styles.searchWrapper}>
            <div className={styles.searchIcon}><Search size={14} color="var(--text)" /></div>
            <input
              value={iconSearch}
              onChange={e => setIconSearch(e.target.value)}
              placeholder={t('settingsCategories.iconSearchPlaceholder')}
              className={`field-input ${styles.searchInput}`}
            />
          </div>
          <div className={styles.iconGroupsContainer}>
            {filteredGroups.map(group => (
              <div key={group.label} className={styles.iconGroup}>
                <div className={styles.iconGroupLabel}>{group.label}</div>
                <div className={styles.iconGrid}>
                  {group.icons.map(({ name: iconName, label }) => {
                    const Icon = getIconComponent(iconName)
                    const selected = icon === iconName
                    return (
                      <button
                        key={iconName}
                        type="button"
                        title={label}
                        onClick={() => setIcon(iconName)}
                        className={`${styles.iconButton} ${selected ? styles.iconButtonSelected : ''}`}
                      >
                        <Icon size={16} color={selected ? 'var(--surface)' : 'var(--text)'} />
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {filteredGroups.length === 0 && (
              <div className={styles.noResultsText}>{t('settingsCategories.noIconResults', { search: iconSearch })}</div>
            )}
          </div>
          <div className={styles.colorGrid}>
            {PALETTE.map(c => {
              const selected = color === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`${styles.colorSwatch} ${selected ? styles.colorSwatchSelected : ''}`}
                  style={{ background: c }}
                >
                  {selected && <Check size={13} color="#fff" strokeWidth={3} />}
                </button>
              )
            })}
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className="field-label">{t('goalFormModal.amountLabel')}</label>
          <AmountInput
            className={`field-input ${styles.inputMt}`}
            value={targetAmount}
            onChange={e => { setTargetAmount(e.target.value); setError('') }}
            placeholder="$0.00"
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className="field-label">{t('goalFormModal.deadlineLabel')}</label>
          <div className={styles.inputMt}>
            <DatePicker value={targetDate} onChange={setTargetDate} placeholder={t('goalFormModal.deadlinePlaceholder')} />
          </div>
        </div>

        {error && <div className={styles.errorText}>{error}</div>}

        <button type="button" onClick={handleSave} disabled={saving} className={`btn-primary ${styles.saveButton}`}>
          {saving ? t('settingsCategories.saving') : t('buttons.save')}
        </button>
        <button type="button" onClick={onClose} className="btn-ghost">{t('buttons.cancel')}</button>
      </div>
    </div>
  )
}
