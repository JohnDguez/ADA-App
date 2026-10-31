import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X, Crown, Users, Receipt, Bell, Plus, Check, LogIn } from 'lucide-react'
import { CurrencySelect } from './CurrencySelect'
import { CobroPeriodFields } from './CobroPeriodFields'
import { AnchoredPop, useAnchor } from './AnchoredPop'
import { Presence } from './Presence'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useIsMobile } from '../hooks/useIsMobile'
import { useBackClose } from '../lib/backNav'
import { usePremiumCta } from '../lib/premiumOffer'
import sp from '../pages/settings/SettingsSharedSpaceTab.module.css'
import styles from './NewSpaceModal.module.css'

// «Nuevo espacio compartido» SIN cambiar de página (v0.9.975, mockup aprobado
// por Johnatan): antes elegir esa opción del menú cambiaba todas las páginas
// al formulario. Ahora se abre encima de donde estés:
// - Escritorio: popover grande anclado al botón del menú lateral (a su derecha).
// - Tablet: diálogo centrado. Móvil: hoja inferior con segmentado Crear/Unirme.
// Al crear o unirse se cierra y `onDone(spaceId)` cambia al espacio.
// Mismos estados que NewSharedSpacePanel: Premium sin espacio propio (crear),
// sin Premium (invitación, texto del botón dinámico vía usePremiumCta) y con
// espacio propio («Ir a mi espacio»). Unirse siempre, hasta 3 como invitado.
export function NewSpaceModal({ open, initialTab = 'create', onClose, profile, sharedSpaces, onOpenPremium, onDone }) {
  const { t } = useTranslation()
  const isDesktop = useIsDesktop()
  const isMobile = useIsMobile()
  const anchorRef = useAnchor(open && isDesktop)
  useBackClose(open && !isDesktop, onClose)

  const [tab, setTab] = useState(initialTab)
  useEffect(() => { if (open) setTab(initialTab) }, [open, initialTab])

  const title = t('newSharedSpacePanel.deskTitle')
  const body = <Content profile={profile} sharedSpaces={sharedSpaces} onOpenPremium={onOpenPremium} onDone={onDone} tab={isMobile ? tab : null} setTab={setTab} />

  if (isDesktop) {
    return (
      <AnchoredPop open={!!open} onClose={onClose} anchorRef={anchorRef} width={820} side="right" className={styles.pop} label={title}>
        <Head title={title} onClose={onClose} sub />
        {body}
      </AnchoredPop>
    )
  }
  return createPortal(
    <Presence show={!!open}>{() => (
      <div className={`${sp.ovl} ${styles.ovl}`} onClick={e => e.target === e.currentTarget && onClose()}>
        <div className={`${sp.dlg} ${styles.dlg}`} role="dialog" aria-modal="true" aria-label={title} data-newchips="">
          <Head title={title} onClose={onClose} sub={!isMobile} />
          {body}
        </div>
      </div>
    )}</Presence>,
    document.body
  )
}

function Head({ title, onClose, sub }) {
  const { t } = useTranslation()
  return (
    <div className={styles.head}>
      <div className={styles.headText}>
        <h2 className={styles.title}>{title}</h2>
        {sub && <p className={styles.sub}>{t('newSharedSpacePanel.deskSub')}</p>}
      </div>
      <button type="button" className={styles.close} onClick={onClose} aria-label={t('buttons.close', { defaultValue: 'Cerrar' })}><X size={18} /></button>
    </div>
  )
}

function Content({ profile, sharedSpaces, onOpenPremium, onDone, tab, setTab }) {
  const { t } = useTranslation()
  const premiumCta = usePremiumCta()
  const { spaces, createSpace, redeemCode } = sharedSpaces
  const isPremium = !!profile.is_premium
  const ownedEntry = spaces.find(s => s.membership.role === 'owner')
  const slotsLeft = 3 - spaces.filter(s => s.membership.role === 'guest').length

  // ── Crear ── (misma lógica que NewSharedSpacePanel)
  const [newName, setNewName] = useState('')
  const [newCurrency, setNewCurrency] = useState(profile.currency || '')
  const [newFreq, setNewFreq] = useState('biweekly')
  const [newDay1, setNewDay1] = useState(1)
  const [newDay2, setNewDay2] = useState(16)
  const [newWeekday, setNewWeekday] = useState(5)
  const [newWeekendShift, setNewWeekendShift] = useState(null)
  const [createError, setCreateError] = useState('')
  const [createSaving, setCreateSaving] = useState(false)
  async function handleCreate() {
    if (!newName.trim()) { setCreateError(t('newSharedSpacePanel.nameRequiredError')); return }
    if (!newCurrency) { setCreateError(t('currency.spaceRequired')); return }
    setCreateSaving(true); setCreateError('')
    const { data, error } = await createSpace({
      name: newName.trim(), isPremium: profile.is_premium, currency: newCurrency, cobroFreq: newFreq,
      cobroDay1: newFreq !== 'weekly' ? newDay1 : undefined,
      cobroDay2: newFreq === 'biweekly' ? newDay2 : undefined,
      cobroWeekday: newFreq === 'weekly' ? newWeekday : undefined,
      weekendShift: newFreq !== 'weekly' ? newWeekendShift : null,
    })
    setCreateSaving(false)
    if (error) setCreateError(typeof error === 'string' ? error : t('newSharedSpacePanel.createGenericError'))
    else if (data?.id) { setNewName(''); onDone(data.id) }
  }

  // ── Unirse ──
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joinSaving, setJoinSaving] = useState(false)
  const [codeFocus, setCodeFocus] = useState(false)
  async function handleJoin() {
    if (joinCode.trim().length !== 6) { setJoinError(t('newSharedSpacePanel.joinCodeLengthError')); return }
    setJoinSaving(true); setJoinError('')
    const { data, error } = await redeemCode(joinCode.trim())
    setJoinSaving(false)
    if (error) setJoinError(typeof error === 'string' ? error : t('newSharedSpacePanel.joinCodeInvalid'))
    else if (data?.space_id) { setJoinCode(''); onDone(data.space_id) }
  }

  const perks = [['perk1', Users], ['perk2', Receipt], ['perk3', Bell]]
  const left = !isPremium ? (
    <section className={styles.pane}>
      <PaneHead icon={<Crown size={18} fill="currentColor" />} gold title={t('newSharedSpacePanel.upsellTitle')} sub={t('newSharedSpacePanel.upsellSub')} />
      <div className={styles.perks}>
        {perks.map(([k, Ic]) => (
          <div className={styles.perk} key={k}>
            <Ic size={16} />
            <div><b>{t(`newSharedSpacePanel.${k}Title`)}</b><span>{t(`newSharedSpacePanel.${k}Sub`)}</span></div>
          </div>
        ))}
      </div>
      <div className={styles.foot}>
        <button type="button" onClick={onOpenPremium} className={`${styles.btn} ${styles.btnGold}`}><Crown size={16} fill="currentColor" /> {premiumCta.cta}</button>
      </div>
      {premiumCta.fine && <div className={styles.fine}>{premiumCta.fine}</div>}
    </section>
  ) : ownedEntry ? (
    <section className={styles.pane}>
      <PaneHead icon={<Check size={18} strokeWidth={2.6} />} title={t('newSharedSpacePanel.ownedTitle')} sub={t('newSharedSpacePanel.ownedSub')} />
      <p className={styles.hint}>{t('newSpaceModal.ownedText', { name: ownedEntry.space.name })}</p>
      <div className={styles.foot}>
        <button type="button" onClick={() => onDone(ownedEntry.space.id)} className={`${styles.btn} ${styles.btnSoft}`}>{t('newSharedSpacePanel.goToSpace')}</button>
      </div>
    </section>
  ) : (
    <section className={styles.pane}>
      <PaneHead icon={<Plus size={18} strokeWidth={2.4} />} title={t('newSpaceModal.createTitle')} sub={t('newSharedSpacePanel.createSub')} />
      <div className={styles.field}>
        <label className="field-label" htmlFor="nsm-name">{t('newSharedSpacePanel.spaceNameLabel')}</label>
        <input id="nsm-name" className={`field-input ${styles.input}`} value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('newSharedSpacePanel.spaceNamePlaceholder')} />
      </div>
      <div className={styles.field}>
        <label className="field-label">{t('currency.spaceLabel')}</label>
        <CurrencySelect value={newCurrency} onChange={setNewCurrency} sheetTitle={t('currency.spaceSheetTitle')} />
      </div>
      <div className={styles.field}>
        <label className="field-label">{t('cobroPeriodFields.periodLabel')}</label>
        <CobroPeriodFields
          freq={newFreq} day1={newDay1} day2={newDay2} weekday={newWeekday}
          onChangeFreq={setNewFreq} onChangeDay1={setNewDay1} onChangeDay2={setNewDay2} onChangeWeekday={setNewWeekday}
          weekendShift={newWeekendShift} onChangeWeekendShift={setNewWeekendShift}
        />
      </div>
      {createError && <div className={styles.err}>{createError}</div>}
      <div className={styles.foot}>
        <button type="button" onClick={handleCreate} disabled={createSaving} className={`${styles.btn} ${styles.btnPri}`}>
          {createSaving ? t('newSharedSpacePanel.creating') : t('newSharedSpacePanel.create')}
        </button>
      </div>
    </section>
  )

  const right = slotsLeft > 0 ? (
    <section className={styles.pane}>
      <PaneHead icon={<LogIn size={18} />} title={t('newSpaceModal.joinTitle')} sub={t(isPremium ? 'newSharedSpacePanel.joinSub' : 'newSharedSpacePanel.joinSubFree')} />
      <p className={styles.hint}>{t('newSpaceModal.joinHint')}</p>
      <div className={sp.codeBoxes}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={`${sp.cbox} ${styles.cbox} ${joinCode[i] ? '' : sp.cboxEmpty} ${codeFocus && i === Math.min(joinCode.length, 5) ? sp.cboxOn : ''}`}>{joinCode[i] || '·'}</span>
        ))}
        <input aria-label={t('newSharedSpacePanel.codeAria')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={joinCode}
          onFocus={() => setCodeFocus(true)} onBlur={() => setCodeFocus(false)}
          onKeyDown={e => { if (e.key === 'Enter' && joinCode.length === 6 && !joinSaving) handleJoin() }}
          onChange={e => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
      </div>
      {joinError && <div className={styles.err}>{joinError}</div>}
      <div className={styles.foot}>
        <button type="button" onClick={handleJoin} disabled={joinSaving || joinCode.length !== 6} className={`${styles.btn} ${styles.btnPri}`}>
          {joinSaving ? t('newSharedSpacePanel.joining') : t('newSharedSpacePanel.join')}
        </button>
      </div>
    </section>
  ) : (
    <section className={styles.pane}><p className={styles.hint}>{t('newSharedSpacePanel.maxJoined')}</p></section>
  )

  // Móvil: segmentado Crear / Unirme (cada sección por separado, sin hoja larguísima).
  if (tab) {
    return (
      <>
        <div className={styles.seg} data-i={tab === 'join' ? 1 : 0} role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'create'} className={tab === 'create' ? styles.segOn : ''} onClick={() => setTab('create')}>{t('newSpaceModal.tabCreate')}</button>
          <button type="button" role="tab" aria-selected={tab === 'join'} className={tab === 'join' ? styles.segOn : ''} onClick={() => setTab('join')}>{t('newSpaceModal.tabJoin')}</button>
        </div>
        <div key={tab} className={styles.tabBody}>{tab === 'join' ? right : left}</div>
      </>
    )
  }
  return <div className={styles.two}>{left}{right}</div>
}

function PaneHead({ icon, title, sub, gold }) {
  return (
    <div className={styles.paneHead}>
      <span className={`${styles.ficha} ${gold ? styles.fichaGold : ''}`}>{icon}</span>
      <div className={styles.paneText}><b>{title}</b><span>{sub}</span></div>
    </div>
  )
}
