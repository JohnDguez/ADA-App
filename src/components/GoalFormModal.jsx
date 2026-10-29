import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Check } from 'lucide-react'
import { CATEGORY_ICON_GROUPS, getIconComponent } from '../lib/categoryIcons'
import { DatePicker } from './DatePicker'
import AmountInput from './AmountInput'
import { X } from 'lucide-react'
import { fmt, dateOf, getMonthsShort } from '../lib/utils'
import { useIsMobile } from '../hooks/useIsMobile'
import { ColorPickerPanel } from './ColorPickerPanel'
import { catInk, isHexColor, colorToHex } from '../lib/colorUtils'
import cf from './CategoryFormDesk.module.css'
import gd from './GoalFormDesk.module.css'
import styles from './GoalFormModal.module.css'
import { useScrollLock } from '../lib/scrollLock'

function prettyDate(str) {
  if (!str) return ''
  const d = dateOf(str)
  return `${d.getDate()} ${getMonthsShort()[d.getMonth()]} ${d.getFullYear()}`
}

const PALETTE = Array.from({ length: 16 }, (_, i) => `var(--palette-${i + 1})`)
const ANIM_MS = 320

// Crear y editar una meta comparten el mismo formulario — `initial` viene
// null para crear, o el objeto de la meta para editar (mismo criterio que
// el resto de modales de edición de la app, ej. PaymentModal).
export function GoalFormModal({ open, initial, onSave, onClose }) {
  useScrollLock(open)
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  // Escritorio y tablet usan el diálogo con vista previa; móvil, la hoja.
  const isDesk = !isMobile
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
  // `entering` se activa DURANTE el render en que `open` pasa a true (no en un
  // efecto): si no, la hoja se pinta primero ya colocada y la animación arranca
  // un frame después, reiniciándose («aparece y vuelve a aparecer»).
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) { setPrevOpen(open); if (open) setEntering(true) }
  const wasOpenRef = useRef(open)
  const closeTimerRef = useRef(null)
  const enterTimerRef = useRef(null)
  useEffect(() => () => { clearTimeout(closeTimerRef.current); clearTimeout(enterTimerRef.current) }, [])
  useEffect(() => {
    if (!wasOpenRef.current && open) {
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

  const customOn = isHexColor(color)
  const ink = catInk(color)
  const colorBlock = (cls) => (
    <>
      <div className={cls.wrap}>
        {PALETTE.map((c, cIdx) => (
          <button key={c} type="button" aria-label={t('buttons.colorN', { n: cIdx + 1 })} aria-pressed={color === c}
            onClick={() => setColor(c)} className={`${cls.sw} ${color === c ? cls.swOn : ''}`} style={{ background: c }}>
            {color === c && <Check size={cls.check} color={catInk(c)} strokeWidth={3} />}
          </button>
        ))}
        <button type="button" aria-label={t('settingsCategories.mobile.customColor')} aria-pressed={customOn}
          onClick={() => { if (!customOn) setColor(colorToHex(color) || '#F5A623') }}
          className={`${cls.sw} ${customOn ? cls.swOn : cls.rainbow}`} style={customOn ? { background: color } : undefined}>
          {customOn && <Check size={cls.check} color={ink} strokeWidth={3} />}
        </button>
      </div>
      {customOn && (cls.panel ? <div className={cls.panel}><ColorPickerPanel value={color} onChange={setColor} /></div> : <ColorPickerPanel value={color} onChange={setColor} />)}
    </>
  )

  if (isDesk) {
    const PreviewIcon = getIconComponent(icon)
    const target = parseFloat(targetAmount) || 0
    return (
      <div onClick={e => e.target === e.currentTarget && onClose()} className={`${gd.overlay} ${closing ? styles.overlayClosing : ''}`}>
        <div className={gd.dialog} role="dialog" aria-modal="true" aria-label={initial ? t('goalFormModal.titleEdit') : t('goalFormModal.titleNew')}>
          <div className={gd.head}>
            <div>
              <h2 className={gd.title}>{initial ? t('goalFormModal.titleEdit') : t('goalFormModal.titleNew')}</h2>
              <div className={gd.sub}>{t('goalsPage.desk.newDesc')}</div>
            </div>
            <button type="button" className={gd.close} onClick={onClose} aria-label={t('buttons.cancel')}><X size={16} /></button>
          </div>
          <div className={gd.body}>
            <div className={gd.form}>
              <div>
                <label className="field-label">{t('goalFormModal.nameLabel')}</label>
                <input aria-label={t('goalFormModal.nameLabel')} autoFocus className="field-input" value={name}
                  onChange={e => { setName(e.target.value); setError('') }} placeholder={t('goalFormModal.namePlaceholder')} />
              </div>
              <div>
                <label className="field-label">{t('goalFormModal.notesLabel')}</label>
                <input aria-label={t('goalFormModal.notesLabel')} className="field-input" value={notes}
                  onChange={e => setNotes(e.target.value)} placeholder={t('goalFormModal.notesPlaceholder')} />
              </div>
              <div className={gd.row2}>
                <div>
                  <label className="field-label">{t('goalFormModal.amountLabel')}</label>
                  <AmountInput className="field-input" value={targetAmount} onChange={e => { setTargetAmount(e.target.value); setError('') }} placeholder="$0.00" />
                </div>
                <div>
                  <label className="field-label">{t('goalFormModal.deadlineLabel')}</label>
                  <DatePicker value={targetDate} onChange={setTargetDate} placeholder={t('goalFormModal.deadlinePlaceholder')} sheet sheetTitle={t('goalFormModal.deadlineLabel')} />
                </div>
              </div>
              <div>
                <label className="field-label">{t('goalFormModal.iconColorLabel')}</label>
                <div className={cf.search}>
                  <Search size={16} />
                  <input aria-label={t('settingsCategories.iconSearchPlaceholder')} value={iconSearch} onChange={e => setIconSearch(e.target.value)} placeholder={t('settingsCategories.iconSearchPlaceholder')} />
                </div>
                <div className={`${cf.groups} ${gd.groups} scroll-y`}>
                  {filteredGroups.map(group => (
                    <div key={group.label}>
                      <div className={cf.gl}>{group.label}</div>
                      <div className={cf.icons}>
                        {group.icons.map(({ name: iconName, label }) => {
                          const Icon = getIconComponent(iconName)
                          return (
                            <button key={iconName} type="button" title={label} onClick={() => setIcon(iconName)} className={`${cf.ib} ${icon === iconName ? cf.ibOn : ''}`}>
                              <Icon size={20} />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  {filteredGroups.length === 0 && <div className={cf.help}>{t('settingsCategories.noIconResults', { search: iconSearch })}</div>}
                </div>
                <div className={gd.colors}>{colorBlock({ wrap: cf.colors, sw: cf.sw, swOn: cf.swOn, rainbow: cf.rainbow, check: 14 })}</div>
              </div>
            </div>
            <aside className={gd.side}>
              <div className={gd.sideTitle}>{t('goalsPage.desk.previewTitle')}</div>
              <div className={gd.preview} style={{ '--tint': color }}>
                <div className={gd.pTop}>
                  <span className={gd.pIcon} style={{ color: ink }}><PreviewIcon size={22} /></span>
                  <b className={gd.pName}>{name.trim() || t('goalsPage.desk.previewName')}</b>
                </div>
                <div className={gd.pAmount}>{fmt(0)}</div>
                <div className={gd.pMeta}>{target > 0 ? `${t('goalsPage.desk.previewLeft')} ${fmt(target)}` : ' '}</div>
                <div className={gd.bar}><i /></div>
                <div className={gd.pMeta}>{targetDate ? prettyDate(targetDate) : t('goalsPage.desk.previewNoDate')}</div>
              </div>
              <div className={gd.hint}>{t('goalsPage.desk.previewHint')}</div>
            </aside>
          </div>
          {error && <div className={styles.errorText}>{error}</div>}
          <div className={gd.foot}>
            <button type="button" onClick={onClose} className={gd.cancel}>{t('buttons.cancel')}</button>
            <button type="button" onClick={handleSave} disabled={saving} className={`btn-primary ${gd.save}`}>
              {saving ? t('settingsCategories.saving') : t('buttons.save')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const MobIcon = getIconComponent(icon)
  const mobTarget = parseFloat(targetAmount) || 0
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`}>
      <div className={`${styles.modal} ${entering ? styles.modalEntering : ''} ${closing ? styles.modalClosing : ''}`} role="dialog" aria-modal="true">
        <div className={styles.handle} />
        <div className={styles.head}>
          <div className={styles.title}>{initial ? t('goalFormModal.titleEdit') : t('goalFormModal.titleNew')}</div>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('buttons.cancel')}><X size={16} /></button>
        </div>

        <div className={styles.body}>
          <div className={styles.preview} style={{ '--tint': color }}>
            <div className={styles.lbl} style={{ margin: 0 }}>{t('goalsPage.desk.previewTitle')}</div>
            <div className={styles.pCard}>
              <div className={styles.pTop}>
                <span className={styles.pIcon} style={{ color: ink }}><MobIcon size={18} /></span>
                <b className={styles.pName}>{name.trim() || t('goalsPage.desk.previewName')}</b>
              </div>
              <div className={styles.pAmount}>{fmt(0)}</div>
              <div className={styles.pMeta}>{mobTarget > 0 ? `${t('goalsPage.desk.previewLeft')} ${fmt(mobTarget)}` : ' '}</div>
              <div className={styles.bar}><i /></div>
              <div className={styles.pMeta}>{targetDate ? prettyDate(targetDate) : t('goalsPage.desk.previewNoDate')}</div>
            </div>
          </div>

          <div>
            <label className={styles.lbl}>{t('goalFormModal.nameLabel')}</label>
            <input aria-label={t('goalFormModal.nameLabel')} className="field-input" value={name}
              onChange={e => { setName(e.target.value); setError('') }} placeholder={t('goalFormModal.namePlaceholder')} />
          </div>

          <div>
            <label className={styles.lbl}>{t('goalFormModal.notesLabel')}</label>
            <input aria-label={t('goalFormModal.notesLabel')} className="field-input" value={notes}
              onChange={e => setNotes(e.target.value)} placeholder={t('goalFormModal.notesPlaceholder')} />
          </div>

          <div className={styles.row2}>
            <div>
              <label className={styles.lbl}>{t('goalFormModal.amountLabel')}</label>
              <AmountInput className="field-input" value={targetAmount}
                onChange={e => { setTargetAmount(e.target.value); setError('') }} placeholder="$0.00" />
            </div>
            <div>
              <label className={styles.lbl}>{t('goalFormModal.deadlineLabel')}</label>
              <DatePicker value={targetDate} onChange={setTargetDate} placeholder={t('goalFormModal.deadlinePlaceholder')} sheet sheetTitle={t('goalFormModal.deadlineLabel')} />
            </div>
          </div>

          <div>
            <label className={styles.lbl}>{t('goalFormModal.iconColorLabel')}</label>
            <div className={styles.search}>
              <Search size={16} />
              <input aria-label={t('settingsCategories.iconSearchPlaceholder')} value={iconSearch}
                onChange={e => setIconSearch(e.target.value)} placeholder={t('settingsCategories.iconSearchPlaceholder')} />
            </div>
            <div className={`${styles.groups} scroll-y`}>
              {filteredGroups.map(group => (
                <div key={group.label}>
                  <div className={styles.gl}>{group.label}</div>
                  <div className={styles.iconGrid}>
                    {group.icons.map(({ name: iconName, label }) => {
                      const Icon = getIconComponent(iconName)
                      return (
                        <button key={iconName} type="button" title={label} onClick={() => setIcon(iconName)}
                          className={`${styles.ib} ${icon === iconName ? styles.ibOn : ''}`}>
                          <Icon size={18} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              {filteredGroups.length === 0 && <div className={styles.help}>{t('settingsCategories.noIconResults', { search: iconSearch })}</div>}
            </div>
            {colorBlock({ wrap: styles.colors, sw: styles.sw, swOn: styles.swOn, rainbow: styles.rainbow, check: 14, panel: styles.picker })}
          </div>

          {error && <div className={styles.errorText}>{error}</div>}
        </div>

        <div className={styles.foot}>
          <button type="button" onClick={onClose} className={styles.cancel}>{t('buttons.cancel')}</button>
          <button type="button" onClick={handleSave} disabled={saving} className={styles.save}>
            {saving ? t('settingsCategories.saving') : t('buttons.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
