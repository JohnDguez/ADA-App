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
import { DeskSettingsHead, DeskPage } from './DeskSettingsHead'
import deskStyles from './SettingsDesk.module.css'
import dk from './CardFormDesk.module.css'
import dkp from './PaymentDesk.module.css'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useIsMobile } from '../hooks/useIsMobile'
import mm from './CardFormMobile.module.css'
import { ChevronLeft, X as XIcon } from 'lucide-react'
import { markBackHandled } from '../lib/backNav'
import { useScrollLock } from '../lib/scrollLock'

// Alta/edición de una tarjeta (v0.9.486, mockups confirmados con Johnatan).
// Arriba, la tarjeta en vivo: cambia de color con el banco, muestra alias,
// últimos 4, red y chip/"Digital" mientras se llenan los campos.
// Entrada y salida animadas (Regla 29) — mismo patrón que GoalFormModal:
// `entering`/`closing` como clases temporales; ANIM_MS debe coincidir con
// las duraciones de CardFormModal.module.css (Regla 30).
const ANIM_MS = 320

const EMPTY = { kind: 'credit', bank: null, alias: '', last4: '', network: 'visa', form: 'physical', cut_day: null, due_day: null }

// `inline` (v0.9.839, escritorio): página dentro del panel de Ajustes.
export function CardFormModal({ open, initial, onSave, onClose, inline = false }) {
  useScrollLock(open && !inline)
  const { t } = useTranslation()
  const isDesk = useIsDesktop()
  const isMobile = useIsMobile()
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

  // "Atrás" del teléfono cierra el formulario (sin esto, cuando se abre
  // encima de otro modal —ej. "Añadir tarjeta" desde Nuevo pago— el "atrás"
  // cerraba el modal de abajo y se perdían los datos).
  useEffect(() => {
    if (!open || inline) return
    const handler = () => { markBackHandled(); onClose() }
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    setForm(initial ? {
      kind: initial.kind, bank: initial.bank, alias: initial.alias || '', last4: initial.last4 || '',
      network: initial.network, form: initial.form, cut_day: initial.cut_day, due_day: initial.due_day,
    } : EMPTY)
    setError('')
  }, [open, initial])

  const showModal = inline ? open : (open || closing || wasOpenRef.current)
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

  const deskFields = (
    <>
            <Segmented value={form.kind} disabled={!!initial} onChange={kind => set({ kind })}
              options={[{ value: 'credit', label: t('cards.kind.credit') }, { value: 'debit', label: t('cards.kind.debit') }]} />
            {initial && <div className={dk.help}>{t('cards.form.kindLocked')}</div>}

            <label className={dk.lbl}>{t('cards.form.bank')}</label>
            <Select value={form.bank} onChange={bank => set({ bank })} options={bankOptions} placeholder={t('cards.form.bankPlaceholder')} searchable
              groupLabels={groupLabels} renderIcon={id => <span className={styles.bankDot} style={{ '--bank-dot': bankColorVar(id) }} />} />

            <div className={dk.row2}>
              <div className={dk.grow}>
                <label className={dk.lbl}>{t('cards.form.alias')}</label>
                <input aria-label={t('cards.form.alias')} className={dk.input} value={form.alias} maxLength={24}
                  onChange={e => set({ alias: e.target.value })} placeholder={t('cards.form.aliasPlaceholder')} />
              </div>
              <div className={dk.last4}>
                <label className={dk.lbl}>{t('cards.form.last4')}</label>
                <input aria-label={t('cards.form.last4')} className={dk.input} inputMode="numeric" value={form.last4}
                  onChange={e => set({ last4: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="0000" />
              </div>
            </div>
            <div className={dk.help}>{t('cards.form.aliasHelper')}</div>

            <div className={dk.row2}>
              <div className={dk.grow}>
                <label className={dk.lbl}>{t('cards.form.network')}</label>
                <Segmented value={form.network} onChange={network => set({ network })}
                  options={NETWORKS.map(n => ({ value: n, label: t(`cards.network.${n}`), icon: <CardNetworkIcon network={n} size={16} className={styles.segIcon} /> }))} />
              </div>
              <div className={dk.grow}>
                <label className={dk.lbl}>{t('cards.form.form')}</label>
                <Segmented value={form.form} onChange={f => set({ form: f })}
                  options={[{ value: 'physical', label: t('cards.form.physical') }, { value: 'digital', label: t('cards.form.digital') }]} />
              </div>
            </div>

            {isCredit ? (
              <>
                <label className={dk.lbl}>{t('cards.form.days')}</label>
                <CardDayRangePicker cutDay={form.cut_day} dueDay={form.due_day} onChange={days => set(days)} />
              </>
            ) : <div className={dk.help}>{t('cards.form.debitNote')}</div>}
    </>
  )

  if (inline) {
    return (
      <DeskPage>
        <DeskSettingsHead
          title={initial ? t('cards.form.titleEdit') : t('cards.form.titleNew')}
          description={t('cards.desk.formDesc')}
          actions={<button type="button" className={`${deskStyles.btn} ${deskStyles.btnSoft}`} onClick={onClose}><ChevronLeft size={16} />{t('buttons.back')}</button>}
        />
        <div className={dk.layout}>
          <div className={deskStyles.fill}>
            {deskFields}
          </div>

          <div className={dk.side}>
            <div className={dk.preview}><CreditCardVisual card={{ ...form, bank: form.bank || 'otro' }} /></div>
            {error && <div className={dk.err}>{error}</div>}
            <button type="button" className={`${deskStyles.btn} ${dk.full}`} onClick={handleSave}>{initial ? t('cards.form.saveEdit') : t('cards.form.saveNew')}</button>
            <button type="button" className={`${deskStyles.btn} ${deskStyles.btnSoft} ${dk.full}`} onClick={onClose}>{t('buttons.cancel')}</button>
          </div>
        </div>
      </DeskPage>
    )
  }

  if (isDesk) {
    return createPortal(
      <div onClick={e => e.target === e.currentTarget && onClose()} className={dkp.overlay} data-presence="overlay" data-closing={closing ? '' : undefined}>
        <div className={`${dkp.dialog} ${dk.dlg}`} role="dialog" aria-modal="true" aria-label={initial ? t('cards.form.titleEdit') : t('cards.form.titleNew')} data-presence="panel" data-closing={closing ? '' : undefined}>
          <div className={dkp.head}>
            <div>
              <h2 className={dkp.title}>{initial ? t('cards.form.titleEdit') : t('cards.form.titleNew')}</h2>
              <div className={dkp.sub}>{t('cards.desk.formDesc')}</div>
            </div>
            <button type="button" className={dkp.close} onClick={onClose} aria-label={t('buttons.cancel')}><XIcon size={16} /></button>
          </div>
          <div className={dk.layout}>
            <div className={dk.dlgForm}>{deskFields}</div>
            <div className={dk.dlgSide}>
              <CreditCardVisual large card={{ ...form, bank: form.bank || 'otro' }} />
            </div>
          </div>
          {error && <div className={dk.err}>{error}</div>}
          <div className={dkp.foot}>
            <button type="button" className={dkp.cancel} onClick={onClose}>{t('buttons.cancel')}</button>
            <button type="button" className={`btn-primary ${dkp.save}`} onClick={handleSave}>{initial ? t('cards.form.saveEdit') : t('cards.form.saveNew')}</button>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  // Móvil (<768px, v0.9.926, mockup aprobado): hoja con ✕, vista previa grande,
  // campos rellenos, segmentados en píldora, selector de días con fondo y pie
  // fijo con "Guardar". Misma lógica de guardado que el resto.
  if (isMobile && !inline) {
    const title = initial ? t('cards.form.titleEdit') : t('cards.form.titleNew')
    return createPortal(
      <div onClick={e => e.target === e.currentTarget && onClose()} className={`${mm.overlay} ${closing ? mm.overlayOut : ''}`}>
        <div className={`${mm.sheet} ${closing ? mm.sheetOut : ''}`} role="dialog" aria-modal="true" aria-label={title}>
          <div className={mm.handle} />
          <div className={mm.hd}>
            <div>
              <h2>{title}</h2>
              <p>{t('cards.disclaimer.title')}</p>
            </div>
            <button type="button" className={mm.x} onClick={onClose} aria-label={t('buttons.cancel')}><XIcon size={17} /></button>
          </div>

          <div className={mm.body}>
            <div className={mm.seg} role="tablist" data-i={form.kind === 'credit' ? 0 : 1}>
              {['credit', 'debit'].map(k => (
                <button key={k} type="button" role="tab" aria-selected={form.kind === k} disabled={!!initial} className={form.kind === k ? mm.segOn : ''} onClick={() => set({ kind: k })}>{t(`cards.kind.${k}`)}</button>
              ))}
            </div>
            {initial && <div className={mm.help}>{t('cards.form.kindLocked')}</div>}

            <div className={mm.prev}>
              <CreditCardVisual card={{ ...form, bank: form.bank || 'otro' }} />
            </div>

            <div className={mm.lbl}>{t('cards.form.bank')}</div>
            <div className={mm.sel}>
              <Select
                value={form.bank}
                onChange={bank => set({ bank })}
                options={bankOptions}
                placeholder={t('cards.form.bankPlaceholder')}
                searchable
                sheet
                sheetTitle={t('cards.form.bank')}
                groupLabels={groupLabels}
                renderIcon={id => <span className={styles.bankDot} style={{ '--bank-dot': bankColorVar(id) }} />}
              />
            </div>

            <div className={mm.row2}>
              <div className={mm.grow}>
                <div className={mm.lbl}>{t('cards.form.alias')}</div>
                <input aria-label={t('cards.form.alias')} className={mm.field} value={form.alias} maxLength={24}
                  onChange={e => set({ alias: e.target.value })} placeholder={t('cards.form.aliasPlaceholder')} />
              </div>
              <div className={mm.last4}>
                <div className={mm.lbl}>{t('cards.form.last4')}</div>
                <input aria-label={t('cards.form.last4')} className={mm.field} inputMode="numeric" value={form.last4}
                  onChange={e => set({ last4: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="0000" />
              </div>
            </div>
            <div className={mm.help}>{t('cards.form.aliasHelper')}</div>

            <div className={mm.lbl}>{t('cards.form.network')}</div>
            <div className={mm.opts}>
              {NETWORKS.map(n => (
                <button key={n} type="button" className={`${mm.opt} ${form.network === n ? mm.optOn : ''}`} onClick={() => set({ network: n })}>
                  <CardNetworkIcon network={n} size={16} className={styles.segIcon} />{t(`cards.network.${n}`)}
                </button>
              ))}
            </div>

            <div className={mm.lbl}>{t('cards.form.form')}</div>
            <div className={mm.opts}>
              {[['physical', t('cards.form.physical')], ['digital', t('cards.form.digital')]].map(([v, label]) => (
                <button key={v} type="button" className={`${mm.opt} ${form.form === v ? mm.optOn : ''}`} onClick={() => set({ form: v })}>{label}</button>
              ))}
            </div>

            {isCredit ? (
              <>
                <div className={mm.lbl}>{t('cards.form.days')}</div>
                <CardDayRangePicker cutDay={form.cut_day} dueDay={form.due_day} onChange={days => set(days)} />
              </>
            ) : <div className={mm.note}>{t('cards.form.debitNote')}</div>}
          </div>

          <div className={mm.ft}>
            {error && <div className={mm.err}>{error}</div>}
            <button type="button" className={mm.save} onClick={handleSave}>{initial ? t('cards.form.saveEdit') : t('cards.form.saveNew')}</button>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()} className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`}>
      <div className={`${styles.modal} ${entering ? styles.modalEntering : ''} ${closing ? styles.modalClosing : ''}`}>
        <div className={styles.handle} />
        <div className={styles.headRow}>
          <div className={styles.title}>{initial ? t('cards.form.titleEdit') : t('cards.form.titleNew')}</div>
          <button type="button" className={styles.closeX} onClick={onClose} aria-label={t('buttons.cancel')}><XIcon size={16} /></button>
        </div>

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
            <input aria-label={t('cards.form.alias')}
              className="field-input"
              value={form.alias}
              maxLength={24}
              onChange={e => set({ alias: e.target.value })}
              placeholder={t('cards.form.aliasPlaceholder')}
            />
          </div>
          <div className={styles.fieldLast4}>
            <label className="field-label">{t('cards.form.last4')}</label>
            <input aria-label={t('cards.form.last4')}
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

        <div className={styles.footer}>
          <button type="button" onClick={handleSave} className="btn-primary">
            {initial ? t('cards.form.saveEdit') : t('cards.form.saveNew')}
          </button>
          <button type="button" onClick={onClose} className={`btn-ghost ${styles.cancel}`}>{t('buttons.cancel')}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
