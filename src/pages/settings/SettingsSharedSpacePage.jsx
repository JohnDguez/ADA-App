import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Check, ChevronLeft, ChevronDown, ChevronUp, Users, Copy, RefreshCw, LogOut, Trash2, Crown, Plus, Pencil, CircleCheck, Banknote, PiggyBank, Target, HandCoins, ArrowDownToLine } from 'lucide-react'
// Ícono del encabezado vía Phosphor Icons (mismo patrón que las demás
// sub-páginas ya migradas, v0.9.442-454) — import directo para tree-shaking real.
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree'
import { Collapse } from '../../components/Collapse'
import { Toggle } from '../../components/SettingsShared'
import { CobroPeriodFields } from '../../components/CobroPeriodFields'
import { NotifOffNotice } from '../../components/NotifOffNotice'
import { CurrencySelect } from '../../components/CurrencySelect'
import { CurrencySheet } from '../../components/CurrencySheet'
import { BottomSheet } from '../../components/BottomSheet'
import { getCurrency } from '../../lib/currency'
import { showToast } from '../../components/Toast'
import { getFrequencyLabel } from '../../lib/utils'
import { useDeskSettings } from '../../components/DeskSettingsContext'
import { DeskSettingsHead, DeskPage } from '../../components/DeskSettingsHead'
import deskStyles from '../../components/SettingsDesk.module.css'
import dk from './SettingsSharedSpaceDesk.module.css'
import dkp from '../../components/PaymentDesk.module.css'
import sp from './SettingsSharedSpaceTab.module.css'
import styles from './SettingsSharedSpacePage.module.css'
import wd from './SettingsCategoriesWide.module.css'
import home from '../DeskHome.module.css'
import tb from './SettingsCobroTab.module.css'
import { AvatarImg } from '../../components/AvatarImg'
import { Presence } from '../../components/Presence'
import { createPortal } from 'react-dom'
import { AnchoredPop, useAnchor } from '../../components/AnchoredPop'
import { useBackClose } from '../../lib/backNav'
import { CURRENCIES, CURRENCY_CODES } from '../../lib/currency'
import { switchProps } from '../../lib/a11y'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useIsDesktop } from '../../hooks/useIsDesktop'

// Permisos del invitado (v0.9.807): definidos aquí para pintarlos como fichas.
const PAYMENT_PERMS = [
  { key: 'can_add',        Icon: Plus,        label: 'settingsSharedSpacePage.permAdd' },
  { key: 'can_edit',       Icon: Pencil,      label: 'settingsSharedSpacePage.permEdit' },
  { key: 'can_mark_paid',  Icon: CircleCheck, label: 'settingsSharedSpacePage.permMarkPaid' },
  { key: 'can_delete',     Icon: Trash2,      label: 'settingsSharedSpacePage.permDelete' },
  { key: 'can_add_income', Icon: Banknote,    label: 'settingsSharedSpacePage.permAddIncome' },
  { key: 'can_add_funds',  Icon: PiggyBank,   label: 'settingsSharedSpacePage.permAddFunds' },
]
const GOAL_PERMS = [
  { key: 'can_add_goals',        Icon: Target,          label: 'settingsSharedSpacePage.permAddGoals' },
  { key: 'can_edit_goals',       Icon: Pencil,          label: 'settingsSharedSpacePage.permEditGoals' },
  { key: 'can_delete_goals',     Icon: Trash2,          label: 'settingsSharedSpacePage.permDeleteGoals' },
  { key: 'can_contribute_goals', Icon: HandCoins,       label: 'settingsSharedSpacePage.permContributeGoals' },
  { key: 'can_withdraw_goals',   Icon: ArrowDownToLine, label: 'settingsSharedSpacePage.permWithdrawGoals', sub: 'settingsSharedSpacePage.permWithdrawGoalsSub' },
]

function PermTile({ Icon, label, sub, on, onToggle }) {
  const { t } = useTranslation()
  return (
    <button type="button" role="switch" aria-checked={on} title={sub} onClick={onToggle}
      className={`${sp.perm} ${on ? sp.permOn : ''}`}>
      <span className={sp.permIcon}><Icon size={17} /></span>
      <span className={sp.permText}>
        <span className={sp.permLabel}>{label}</span>
        <span className={sp.permStatus}>{on ? t('settingsSharedSpacePage.permTileOn') : t('settingsSharedSpacePage.permTileOff')}</span>
      </span>
    </button>
  )
}


// Diálogo del nuevo diseño: hoja inferior en móvil, diálogo centrado en tablet.
function SpaceDialog({ open, onClose, icon: Icon, title, subtitle, children }) {
  const { t } = useTranslation()
  useBackClose(open, onClose)
  return createPortal(
    <Presence show={!!open}>{() => (
      <div className={sp.ovl} onClick={e => e.target === e.currentTarget && onClose()}>
        <div className={sp.dlg} role="dialog" aria-modal="true" aria-label={title}>
          <div className={sp.dHead}>
            <span className={sp.dIco}><Icon size={22} /></span>
            <div className={sp.dText}>
              <div className={sp.dTitle}>{title}</div>
              {subtitle && <div className={sp.dSub}>{subtitle}</div>}
            </div>
            <button type="button" className={sp.dClose} onClick={onClose} aria-label={t('buttons.close', { defaultValue: 'Cerrar' })}><X size={16} /></button>
          </div>
          {children}
        </div>
      </div>
    )}</Presence>,
    document.body
  )
}

// Selector de moneda: popover anclado al campo (en todos los tamaños), selección rápida.
function CurrencyDialog({ open, onClose, value, onSelect, title }) {
  const { t } = useTranslation()
  const anchorRef = useAnchor(open)
  return (
    <AnchoredPop open={!!open} onClose={onClose} anchorRef={anchorRef} width={340} label={title}>
      <div className={sp.curCap}>{title}</div>
      <div className={sp.curList}>
        {CURRENCY_CODES.map(code => (
          <button key={code} type="button" onClick={() => onSelect(code)} className={`${sp.curOpt} ${value === code ? sp.curOptOn : ''}`}>
            <span>{`${t(`currency.names.${code}`)} (${CURRENCIES[code].code})`}</span>
            {value === code && <Check size={18} color="var(--accent)" />}
          </button>
        ))}
      </div>
    </AnchoredPop>
  )
}

// Código de 6 dígitos en casillas (un solo <input> invisible encima).
function CodeBoxes({ value, onChange, onEnter, label, autoFocus }) {
  const [focus, setFocus] = useState(false)
  return (
    <div className={sp.codeBoxes}>
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className={`${sp.cbox} ${value[i] ? '' : sp.cboxEmpty} ${focus && i === Math.min(value.length, 5) ? sp.cboxOn : ''}`}>{value[i] || '·'}</span>
      ))}
      <input aria-label={label} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={value} autoFocus={autoFocus}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        onKeyDown={e => e.key === 'Enter' && onEnter?.()}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} />
    </div>
  )
}

// Sub-página de Ajustes → "Espacio Compartido". Sirve para 2 casos a la vez,
// para no duplicar el formulario de crear/unirse en otro lugar (ej. la
// tarjeta vacía del selector de Home solo navega aquí):
// - Si el usuario no pertenece a ningún espacio: estado vacío con «Unirme con un
//   código» en grande y crear (solo Premium, máximo 1 propio).
// - Si ya pertenece a alguno: panel de administración (si es dueño) y/o
//   lista de espacios donde es invitado (con opción de salirse).
// v0.9.954: rediseño para móvil, tablet (vertical/horizontal) y escritorio.
export function SettingsSharedSpacePage({ profile, user, sharedSpaces, onBack, onOpenPremium, onGoNotifications, slideClass }) {
  const { t } = useTranslation()
  const desk = useDeskSettings()
  const isMobile = useIsMobile()
  const isDesktop = useIsDesktop()
  const mode = desk ? (isDesktop ? 'wide' : 'pane') : isMobile ? 'mobile' : 'tablet'
  const { spaces, createSpace, regenerateCode, redeemCode, updateMemberPermissions, updateSpaceConfig, leaveSpace, removeMember, deleteSpace, clearSpaceData } = sharedSpaces

  const ownedEntry  = spaces.find(s => s.membership.role === 'owner')
  const guestEntries = spaces.filter(s => s.membership.role === 'guest')

  // ── Crear ──
  const [creating,    setCreating]    = useState(false)
  const [newName,     setNewName]     = useState('')
  const [newCurrency, setNewCurrency] = useState(profile.currency || '')
  const [newFreq,     setNewFreq]     = useState('biweekly')
  const [newDay1,     setNewDay1]     = useState(1)
  const [newDay2,     setNewDay2]     = useState(16)
  const [newWeekday,  setNewWeekday]  = useState(5)
  const [createError, setCreateError] = useState('')
  const [createSaving,setCreateSaving]= useState(false)
  const [newCurrencyOpen, setNewCurrencyOpen] = useState(false)

  async function handleCreate() {
    if (!newName.trim()) { setCreateError(t('newSharedSpacePanel.nameRequiredError')); return }
    if (!newCurrency) { setCreateError(t('currency.spaceRequired')); return }
    setCreateSaving(true)
    setCreateError('')
    const { error } = await createSpace({
      name: newName.trim(),
      isPremium: profile.is_premium,
      currency: newCurrency,
      cobroFreq: newFreq,
      cobroDay1: newFreq !== 'weekly' ? newDay1 : undefined,
      cobroDay2: newFreq === 'biweekly' ? newDay2 : undefined,
      cobroWeekday: newFreq === 'weekly' ? newWeekday : undefined,
    })
    setCreateSaving(false)
    if (error) setCreateError(typeof error === 'string' ? error : t('newSharedSpacePanel.createGenericError'))
    else { setCreating(false); setNewName('') }
  }
  function cancelCreate() { setCreating(false); setCreateError('') }

  // ── Unirse ──
  const [joinCode,   setJoinCode]   = useState('')
  const [joinError,  setJoinError]  = useState('')
  const [joinSaving, setJoinSaving] = useState(false)
  const [joinOpen,   setJoinOpen]   = useState(false)

  async function handleJoin() {
    if (joinCode.trim().length !== 6) { setJoinError(t('newSharedSpacePanel.joinCodeLengthError')); return }
    setJoinSaving(true)
    setJoinError('')
    const { error } = await redeemCode(joinCode.trim())
    setJoinSaving(false)
    if (error) setJoinError(typeof error === 'string' ? error : t('newSharedSpacePanel.joinCodeInvalid'))
    else { setJoinCode(''); setJoinOpen(false) }
  }

  const canCreateMore = profile.is_premium && !ownedEntry
  const canJoinMore   = guestEntries.length < 3
  const showEmpty     = !ownedEntry && guestEntries.length === 0
  const showCreating  = creating && canCreateMore

  const joinDisabled = joinSaving || joinCode.length !== 6
  const joinAction = (
    <button type="button" onClick={handleJoin} disabled={joinDisabled} className={sp.btnFull}>
      {joinSaving ? t('newSharedSpacePanel.joining') : t('newSharedSpacePanel.join')}
    </button>
  )
  const joinBody = (
    <>
      {mode === 'wide' && <div className={sp.joinDesc}>{t('settingsSharedSpacePage.joinDescription')}</div>}
      <CodeBoxes value={joinCode} onChange={setJoinCode} onEnter={handleJoin} label={t('newSharedSpacePanel.joinTitle')} autoFocus />
      {joinError && <div className={sp.err}>{joinError}</div>}
    </>
  )
  const joinSheet = canJoinMore && (mode === 'wide' ? (
    <BottomSheet open={joinOpen} title={t('newSharedSpacePanel.joinTitle')} onClose={() => setJoinOpen(false)}>
      <div className={sp.joinSheet}>{joinBody}{joinAction}</div>
    </BottomSheet>
  ) : (
    <SpaceDialog open={joinOpen} onClose={() => setJoinOpen(false)} icon={Users} title={t('newSharedSpacePanel.joinTitle')} subtitle={t('settingsSharedSpacePage.joinSub')}>
      <div className={sp.joinSheet}>{joinBody}</div>
      <div className={sp.dFoot}>
        <button type="button" className={`${sp.btnFull} ${sp.btnOut}`} onClick={() => setJoinOpen(false)}>{t('buttons.cancel')}</button>
        {joinAction}
      </div>
    </SpaceDialog>
  ))
  const openJoin = () => { setJoinError(''); setJoinOpen(true) }

  // Tarjeta «Crear espacio» (Premium) o invitación a Premium (dorada).
  const createCard = (extra = '') => canCreateMore ? (
    <div className={`${sp.big} ${extra}`}>
      <span className={`${sp.bigIco} ${sp.bigIcoAcc}`}><Plus size={24} /></span>
      <div>
        <div className={sp.bigTitle}>{t('settingsSharedSpacePage.createCardTitle')}</div>
        <div className={sp.bigSub}>{t('settingsSharedSpacePage.createCardSub')}</div>
      </div>
      <div className={sp.fillSpace} />
      <button type="button" className={`${sp.btnFull} ${sp.btnSoft}`} onClick={() => setCreating(true)}><Plus size={17} />{t('settingsSharedSpacePage.createCardButton')}</button>
    </div>
  ) : !ownedEntry && !profile.is_premium ? (
    <div className={`${sp.big} ${sp.gold} ${extra}`}>
      <span className={sp.bigIco}><Crown size={24} /></span>
      <div>
        <div className={sp.bigTitle}>{t('newSharedSpacePanel.premiumCtaTitle')}</div>
        <div className={sp.bigSub}>{t('newSharedSpacePanel.premiumCtaText')}</div>
      </div>
      <div className={sp.fillSpace} />
      <button type="button" className={`${sp.btnFull} ${sp.btnGold}`} onClick={onOpenPremium}><Crown size={17} />{t('goalsPage.premiumBanner.button')}</button>
    </div>
  ) : null

  // ── Estado vacío: unirse con código en grande ──
  const emptyView = (
    <div className={sp.empty}>
      <div className={sp.emptyHead}>
        <span className={sp.emptyIco}><UsersThree size={36} /></span>
        <h2 className={sp.emptyTitle}>{t('settingsSharedSpacePage.emptyTitle')}</h2>
        <p className={sp.emptySub}>{t('settingsSharedSpacePage.emptySub')}</p>
      </div>
      <div className={sp.emptyCards}>
        <div className={sp.big}>
          <span className={sp.bigIco}><Users size={24} /></span>
          <div>
            <div className={sp.bigTitle}>{t('settingsSharedSpacePage.joinCardTitle')}</div>
            <div className={sp.bigSub}>{t('settingsSharedSpacePage.joinCardSub')}</div>
          </div>
          <CodeBoxes value={joinCode} onChange={setJoinCode} onEnter={handleJoin} label={t('newSharedSpacePanel.joinTitle')} />
          {joinError && <div className={sp.err}>{joinError}</div>}
          {joinAction}
        </div>
        {createCard()}
      </div>
    </div>
  )

  // ── Crear espacio ──
  const createPreview = (
    <div className={`${deskStyles.blue} ${sp.newPreview}`}>
      <UsersThree size={34} />
      <b>{newName.trim() || t('newSharedSpacePanel.spaceNamePlaceholder')}</b>
      <span>{getFrequencyLabel(newFreq)} · {newCurrency || '—'}</span>
    </div>
  )
  const createForm = (
    <div className={sp.panel} data-newchips="">
      <label className="field-label">{t('newSharedSpacePanel.spaceNameLabel')}</label>
      <input aria-label={t('newSharedSpacePanel.spaceNameLabel')} autoFocus={desk} className="field-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('newSharedSpacePanel.spaceNamePlaceholder')} />
      <label className={`field-label ${sp.cfgField}`} style={{ display: 'block' }}>{t('currency.spaceLabel')}</label>
      {mode === 'wide'
        ? <CurrencySelect value={newCurrency} onChange={setNewCurrency} sheetTitle={t('currency.spaceSheetTitle')} />
        : <button type="button" className={`field-input ${sp.curBtnField}`} onClick={() => setNewCurrencyOpen(true)}>
            <span>{newCurrency ? `${t(`currency.names.${newCurrency}`)} (${newCurrency})` : t('currency.placeholder')}</span><ChevronDown size={16} color="var(--text)" />
          </button>}
      <label className={`field-label ${sp.cfgField}`} style={{ display: 'block' }}>{t('cobroPeriodFields.periodLabel')}</label>
      <CobroPeriodFields
        freq={newFreq} day1={newDay1} day2={newDay2} weekday={newWeekday}
        onChangeFreq={setNewFreq} onChangeDay1={setNewDay1} onChangeDay2={setNewDay2} onChangeWeekday={setNewWeekday}
      />
    </div>
  )
  const createButtons = (
    <>
      {createError && <div className={sp.err}>{createError}</div>}
      <div className={mode === 'wide' ? sp.newSide : sp.btnRow}>
        <button type="button" className={sp.btnFull} onClick={handleCreate} disabled={createSaving}>{createSaving ? t('newSharedSpacePanel.creating') : t('newSharedSpacePanel.create')}</button>
        <button type="button" className={`${sp.btnFull} ${sp.btnOut}`} onClick={cancelCreate}>{t('buttons.cancel')}</button>
      </div>
    </>
  )
  const newCurDialog = <CurrencyDialog open={newCurrencyOpen} onClose={() => setNewCurrencyOpen(false)} value={newCurrency} onSelect={c => { setNewCurrency(c); setNewCurrencyOpen(false) }} title={t('currency.spaceSheetTitle')} />
  const createView = desk ? (
    <div className={sp.newLayout}>
      {createForm}
      <div className={sp.newSide}>{createPreview}{createButtons}</div>
      {newCurDialog}
    </div>
  ) : (
    <div className={sp.newStack}>{createPreview}{createForm}{createButtons}{newCurDialog}</div>
  )

  // ── Espacios donde te invitaron ──
  const guestSection = guestEntries.length > 0 && (
    desk ? (
      <>
        <div className={`${deskStyles.sec} ${ownedEntry ? '' : deskStyles.secFirst}`}>{t('settingsSharedSpacePage.invitedSpacesCount', { n: guestEntries.length })}</div>
        <div className={dk.guestGrid}>
          {guestEntries.map(entry => {
            const cur = getCurrency(entry.space.currency)
            return (
              <div key={entry.membership.id} className={`${sp.panel} ${dk.guestCard}`}>
                <div className={dk.guestTop}>
                  <span className={dk.guestAv}>{(entry.space.name || '?').trim().charAt(0).toUpperCase()}</span>
                  <div className={dk.guestInfo}>
                    <b>{entry.space.name}</b>
                    <span>{t('settingsSharedSpacePage.period', { freq: getFrequencyLabel(entry.space.cobro_freq) })} · {cur.code}</span>
                  </div>
                  <button type="button" className={`${deskStyles.btn} ${deskStyles.btnSoft}`} onClick={() => leaveSpace(entry.membership.id)}><LogOut size={14} />{t('settingsSharedSpacePage.leave')}</button>
                </div>
                <div {...switchProps(entry.membership.notify_on_changes)} className={deskStyles.tgl}
                  onClick={() => updateMemberPermissions(entry.membership.id, { notify_on_changes: !entry.membership.notify_on_changes })}>
                  <div><b>{t('settingsSharedSpacePage.notifyMeLabel')}</b><span>{t('settingsSharedSpacePage.notifyMeSubGuest')}</span></div>
                  <Toggle on={entry.membership.notify_on_changes} />
                </div>
                <NotifOffNotice userId={user?.id} show={entry.membership.notify_on_changes} onGo={onGoNotifications} />
              </div>
            )
          })}
        </div>
      </>
    ) : (
      <>
        <div className={sp.sec}>{t('settingsSharedSpacePage.invitedSpacesLabel')}</div>
        {guestEntries.map(entry => (
          <GuestSpaceRow
            key={entry.membership.id}
            entry={entry}
            userId={user?.id}
            onGoNotifications={onGoNotifications}
            onLeave={() => leaveSpace(entry.membership.id)}
            onToggleNotify={() => updateMemberPermissions(entry.membership.id, { notify_on_changes: !entry.membership.notify_on_changes })}
          />
        ))}
      </>
    )
  )

  const body = showCreating ? createView : showEmpty ? emptyView : (
    <>
      {ownedEntry && (
        <OwnedSpacePanel
          entry={ownedEntry} user={user} mode={mode} onGoNotifications={onGoNotifications}
          regenerateCode={regenerateCode} updateMemberPermissions={updateMemberPermissions}
          updateSpaceConfig={updateSpaceConfig} removeMember={removeMember}
          deleteSpace={deleteSpace} clearSpaceData={clearSpaceData}
        />
      )}
      {guestSection}
      {!ownedEntry && createCard()}
      {!canJoinMore && <div className={sp.hint}>{t('newSharedSpacePanel.maxJoined')}</div>}
    </>
  )

  const title = showCreating ? t('settingsSharedSpacePage.deskNewTitle') : t('settingsSharedSpacePage.title')
  const description = showCreating ? t('settingsSharedSpacePage.deskNewDesc') : t('settingsSharedSpacePage.description')
  const showJoinBtn = canJoinMore && !showEmpty && !showCreating

  if (desk) {
    return (
      <DeskPage gray>
        <DeskSettingsHead
          title={title}
          description={description}
          actions={showCreating
            ? <button type="button" className={`${deskStyles.btn} ${deskStyles.btnSoft}`} onClick={cancelCreate}><ChevronLeft size={16} />{t('buttons.back')}</button>
            : showJoinBtn && <button type="button" className={`${deskStyles.btn} ${deskStyles.btnSoft}`} onClick={openJoin}><Users size={16} />{t('settingsSharedSpacePage.deskJoin')}</button>}
        />
        {body}
        {joinSheet}
      </DeskPage>
    )
  }

  if (mode === 'tablet') {
    return (
      <>
        <div className={`${slideClass} ${home.root} ${home.tablet}`}>
          <header className={`${home.head} ${tb.headBar}`}>
            <div className={`${home.headText} ${tb.headRow}`}>
              <button type="button" className={tb.back} onClick={showCreating ? cancelCreate : onBack} aria-label={t('buttons.back')}><ChevronLeft size={20} /></button>
              <div>
                <div className={home.date}>{description}</div>
                <h1 className={home.hello}>{title}</h1>
              </div>
            </div>
          </header>
          <div className={sp.page}>{body}</div>
        </div>
        {showJoinBtn && (
          <div className={wd.pillRow}>
            <button type="button" onClick={openJoin} className={wd.pill}>
              <Users size={19} strokeWidth={2.4} />
              {t('settingsSharedSpacePage.joinFab')}
            </button>
          </div>
        )}
        {joinSheet}
      </>
    )
  }

  return (
    <>
      <div className={`${slideClass} ${styles.pageRoot}`}>
        <div className={sp.mHead}>
          <button type="button" className={sp.mBack} onClick={showCreating ? cancelCreate : onBack} aria-label={t('buttons.back')}><ChevronLeft size={20} /></button>
          <span className={sp.mIco}><UsersThree size={20} /></span>
          <h1 className={sp.mTitle}>{title}</h1>
        </div>
        <p className={sp.mDesc}>{description}</p>
        <div className={sp.mobilePage}>{body}</div>
      </div>
      {showJoinBtn && (
        <div className={`${styles.addPillRow} ${sp.mPillRow}`}>
          <button type="button" onClick={openJoin} className={styles.addPill}>
            <Users size={18} color="var(--surface)" />
            {t('settingsSharedSpacePage.joinFab')}
          </button>
        </div>
      )}
      {joinSheet}
    </>
  )
}

// ── Fila plegable de un espacio donde te invitaron (móvil / tablet vertical) ──
function GuestSpaceRow({ entry, userId, onGoNotifications, onLeave, onToggleNotify }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const cur = getCurrency(entry.space.currency)

  return (
    <div className={sp.guestWrap}>
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(v => !v)} className={`${sp.guestRow} ${expanded ? sp.guestRowOpen : ''}`}>
        <span className={sp.guestIco}><Users size={18} color="var(--text)" /></span>
        <span className={sp.guestName}>{entry.space.name}</span>
        {expanded ? <ChevronUp size={18} color="var(--text)" /> : <ChevronDown size={18} color="var(--text)" />}
      </button>

      <Collapse open={expanded}>
        <div className={sp.guestBody}>
          <div className={sp.chips}>
            <span className={sp.chip}>{t('settingsSharedSpacePage.period', { freq: getFrequencyLabel(entry.space.cobro_freq) })}</span>
            <span className={sp.chip}>{t('currency.spaceLabel')}: {t(`currency.names.${cur.code}`)} ({cur.code}) · {t('currency.guestHint')}</span>
          </div>
          <div {...switchProps(entry.membership.notify_on_changes)} className={styles.notifyRow} onClick={onToggleNotify}>
            <div>
              <div className={styles.notifyRowTitle}>{t('settingsSharedSpacePage.notifyMeLabel')}</div>
              <div className={styles.notifyRowSubtitle}>{t('settingsSharedSpacePage.notifyMeSubGuest')}</div>
            </div>
            <Toggle on={entry.membership.notify_on_changes} />
          </div>
          <NotifOffNotice userId={userId} show={entry.membership.notify_on_changes} onGo={onGoNotifications} />
          <button type="button" onClick={onLeave} className={sp.leaveBtn}>
            <LogOut size={16} /> {t('settingsSharedSpacePage.leave')}
          </button>
        </div>
      </Collapse>
    </div>
  )
}

const PERM_KEYS = [
  'can_add', 'can_edit', 'can_mark_paid', 'can_delete', 'can_add_income', 'can_add_funds',
  'can_add_goals', 'can_edit_goals', 'can_delete_goals', 'can_contribute_goals', 'can_withdraw_goals',
]

// ── Panel de administración del espacio propio ──────────────────────────────
function OwnedSpacePanel({ entry, user, mode, onGoNotifications, regenerateCode, updateMemberPermissions, updateSpaceConfig, removeMember, deleteSpace, clearSpaceData }) {
  const { t } = useTranslation()
  const desk = useDeskSettings()
  const [copied,        setCopied]        = useState(false)
  const [regenerating,  setRegenerating]  = useState(false)
  const [nameInput,     setNameInput]     = useState(entry.space.name)
  const [dangerOpen,    setDangerOpen]    = useState(false)
  const [confirmExpel,  setConfirmExpel]  = useState(null)
  const [openMemberId,  setOpenMemberId]  = useState(null) // invitado con permisos desplegados
  const [currencyOpen,  setCurrencyOpen]  = useState(false)
  const [confirmRegen,  setConfirmRegen]  = useState(false)
  const [expelling,     setExpelling]     = useState(false)
  const [confirmClear,  setConfirmClear]  = useState(false)
  const [clearing,      setClearing]      = useState(false)
  const [dangerPassword,setDangerPassword]= useState('')
  const [dangerError,   setDangerError]   = useState('')
  const [dangerLoading, setDangerLoading] = useState(false)

  const guestMembers = entry.space.members?.filter?.(m => m.role === 'guest') || []

  async function handleCobroChange(updates) {
    await updateSpaceConfig(entry.space.id, updates)
  }

  async function handleNameBlur() {
    const trimmed = nameInput.trim()
    if (!trimmed) { setNameInput(entry.space.name); return }
    if (trimmed === entry.space.name) return
    await updateSpaceConfig(entry.space.id, { name: trimmed })
    showToast(t('settingsSharedSpacePage.changesSaved'))
  }

  async function handleExpel(membershipId) {
    setExpelling(true)
    const { error } = await removeMember(membershipId)
    setExpelling(false)
    setConfirmExpel(null)
    if (error) showToast(t('settingsSharedSpacePage.expelError'))
    else showToast(t('settingsSharedSpacePage.expelSuccess'))
  }

  async function handleClearData() {
    setClearing(true)
    const { error } = await clearSpaceData(entry.space.id)
    setClearing(false)
    setConfirmClear(false)
    if (error) showToast(t('settingsSharedSpacePage.clearDataError'))
    else showToast(t('settingsSharedSpacePage.clearDataSuccess'))
  }

  function copyCode() {
    navigator.clipboard?.writeText(entry.space.access_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function handleRegenerate() {
    setRegenerating(true)
    await regenerateCode(entry.space.id)
    setRegenerating(false)
    setConfirmRegen(false)
  }

  async function handleCurrency(code) {
    setCurrencyOpen(false)
    if (code === entry.space.currency) return
    await handleCobroChange({ currency: code })
    showToast(t('settingsSharedSpacePage.changesSaved'))
  }

  // Mismo patrón que SettingsAccountPage.jsx: reautentica con contraseña
  // ANTES de proceder — no se reinventa el estilo, se replica.
  async function handleDelete() {
    if (!dangerPassword) { setDangerError(t('activeSpaceHeader.errors.passwordRequired')); return }
    setDangerLoading(true)
    setDangerError('')
    const { error } = await deleteSpace(entry.space.id, user?.email, dangerPassword)
    setDangerLoading(false)
    if (error) setDangerError(typeof error === 'string' ? error : t('activeSpaceHeader.errors.wrongPassword'))
    else { setDangerOpen(false); setDangerPassword('') }
  }

  const modals = (
    <>
      {mode === 'wide'
        ? <CurrencySheet open={currencyOpen} onClose={() => setCurrencyOpen(false)} value={entry.space.currency} onSelect={handleCurrency} title={t('currency.spaceSheetTitle')} />
        : <CurrencyDialog open={currencyOpen} onClose={() => setCurrencyOpen(false)} value={entry.space.currency} onSelect={handleCurrency} title={t('currency.spaceSheetTitle')} />}
      <Presence show={!!(dangerOpen)}>{() => (
        <div onClick={e => e.target === e.currentTarget && setDangerOpen(false)} className={desk ? dkp.overlay : styles.deleteModalOverlay}>
          <div className={desk ? `${dkp.dialog} ${dk.delDlg}` : styles.deleteModalSheet} role={desk ? 'dialog' : undefined} aria-modal={desk ? 'true' : undefined}>
            {desk && <div className={dk.delIcon}><Trash2 size={22} /></div>}
            <div className={desk ? dk.delTitle : styles.deleteModalTitle}>{t('activeSpaceHeader.deleteModal.title')}</div>
            <div className={desk ? dk.delDesc : styles.deleteModalDescription}>
              {t('activeSpaceHeader.deleteModal.description')}
            </div>
            <label className={`field-label ${styles.labelBlock}`}>{t('settingsAccount.dangerModal.confirmLabel')}</label>
            <input aria-label={t('settingsAccount.dangerModal.confirmLabel')}
              type="password" className={`field-input ${styles.deleteModalPasswordInput}`} value={dangerPassword}
              autoFocus={desk}
              onChange={e => setDangerPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDelete()}
              placeholder="••••••••"
            />
            {dangerError && <div className={styles.errorText}>{dangerError}</div>}
            <div className={desk ? dk.delFoot : undefined}>
              <button
                onClick={handleDelete}
                disabled={dangerLoading || !dangerPassword}
                className={desk ? dk.delBtn : `${styles.deleteModalConfirmButton} ${(dangerLoading || !dangerPassword) ? styles.savingOpacity : ''}`}
              >
                {dangerLoading ? t('settingsAccount.dangerModal.verifying') : t('activeSpaceHeader.deleteModal.confirmButton')}
              </button>
              <button onClick={() => { setDangerOpen(false); setDangerPassword('') }} className={desk ? dkp.cancel : 'btn-ghost'}>{t('buttons.cancel')}</button>
            </div>
          </div>
        </div>
      )}</Presence>
    </>
  )

  const members = entry.space.members?.length ? entry.space.members : guestMembers
  const count = Math.max(members.length, guestMembers.length + 1)
  const nm = m => m.profile?.name || t('settingsSharedSpacePage.guestFallback')
  const remaining = 2 - guestMembers.length
  return (
    <>
      <div className={`${sp.owned} ${sp[mode]}`}>
        <div className={sp.col}>
          <div className={`${deskStyles.blue} ${dk.hero} ${sp.oHero}`}>
            <span className={deskStyles.sub}><Crown size={13} style={{ verticalAlign: '-2px' }} /> {t('settingsSharedSpacePage.deskOwnerBadge')}</span>
            <div className={dk.heroName}>{entry.space.name}</div>
            <div className={dk.heroRow}>
              <div className={dk.stack}>
                {members.slice(0, 4).map(m => (
                  <div key={m.id}>
                    <AvatarImg src={m.profile?.avatar_url} className={dk.img} fallback={<div className={dk.stackFb}>{nm(m).slice(0, 1).toUpperCase()}</div>} />
                  </div>
                ))}
              </div>
              <span>{t('settingsSharedSpacePage.deskMembers', { count })}</span>
            </div>
          </div>

          <div className={`${sp.panel} ${sp.oCfg}`} data-newchips="">
            <div className={sp.panelTitle}>{t('settingsSharedSpacePage.deskConfig')}</div>
            <div className={sp.cfgRow}>
              <div>
                <label className={sp.lab}>{t('newSharedSpacePanel.spaceNameLabel')}</label>
                <input aria-label={t('newSharedSpacePanel.spaceNameLabel')} className="field-input" value={nameInput}
                  onChange={e => setNameInput(e.target.value)} onBlur={handleNameBlur}
                  onKeyDown={e => e.key === 'Enter' && e.target.blur()} />
              </div>
              <div>
                <label className={sp.lab}>{t('settingsCobro.currencyLabel')}</label>
                <button type="button" onClick={() => setCurrencyOpen(true)} className={`field-input ${dk.curBtn}`}>
                  {getCurrency(entry.space.currency).code}<ChevronDown size={14} color="var(--text)" />
                </button>
              </div>
            </div>
            <div className={sp.cfgField}>
              <label className={sp.lab}>{t('cobroPeriodFields.periodLabel')}</label>
              <CobroPeriodFields
                freq={entry.space.cobro_freq} day1={entry.space.cobro_day1} day2={entry.space.cobro_day2} weekday={entry.space.cobro_weekday}
                onChangeFreq={v => handleCobroChange({ cobro_freq: v })} onChangeDay1={v => handleCobroChange({ cobro_day1: v })}
                onChangeDay2={v => handleCobroChange({ cobro_day2: v })} onChangeWeekday={v => handleCobroChange({ cobro_weekday: v })}
              />
            </div>
          </div>

          <div className={`${sp.panel} ${sp.oMem}`}>
            <div className={sp.panelTitle}>{t('settingsSharedSpacePage.deskMembersTitle')}</div>
            {guestMembers.length === 0 && <div className={sp.hint}>{t('settingsSharedSpacePage.inviteHint', { count: remaining })}</div>}
            {guestMembers.map(m => {
              const guestName = nm(m)
              const isOpen = openMemberId === m.id
              const isConfirming = confirmExpel === m.id
              const onCount = PERM_KEYS.filter(k => m[k]).length
              return (
                <div key={m.id} className={sp.member}>
                  <button type="button" aria-expanded={isOpen} className={sp.memberHead} onClick={() => setOpenMemberId(isOpen ? null : m.id)}>
                    <div className={dk.avatar}><AvatarImg src={m.profile?.avatar_url} className={dk.img} fallback={<div className={dk.avatarFb}>{guestName.slice(0, 2).toUpperCase()}</div>} /></div>
                    <div className={sp.memberText}><b>{guestName}</b><span>{t('settingsSharedSpacePage.permSummary', { on: onCount, total: PERM_KEYS.length })}</span></div>
                    <span className={sp.role}>{t('settingsSharedSpacePage.guestFallback')}</span>
                    {isOpen ? <ChevronUp size={18} color="var(--text)" /> : <ChevronDown size={18} color="var(--text)" />}
                  </button>
                  <Collapse open={isOpen}>
                    <div className={dk.perms}>
                      <div className={dk.permLabel}>{t('settingsSharedSpacePage.permGroupPayments')}</div>
                      <div className={sp.permGrid}>
                        {PAYMENT_PERMS.map(({ key, Icon, label }) => (
                          <PermTile key={key} Icon={Icon} label={t(label)} on={!!m[key]} onToggle={() => updateMemberPermissions(m.id, { [key]: !m[key] })} />
                        ))}
                      </div>
                      <div className={dk.permLabel}>{t('settingsSharedSpacePage.permGroupGoals')}</div>
                      <div className={sp.permGrid}>
                        {GOAL_PERMS.map(({ key, Icon, label, sub }) => (
                          <PermTile key={key} Icon={Icon} label={t(label)} sub={sub ? t(sub) : undefined} on={!!m[key]} onToggle={() => updateMemberPermissions(m.id, { [key]: !m[key] })} />
                        ))}
                      </div>
                      <button type="button" className={dk.linkDanger} onClick={() => setConfirmExpel(isConfirming ? null : m.id)}>
                        <LogOut size={15} />{t('settingsSharedSpacePage.removeFromSpace')}
                      </button>
                      <Collapse open={!!isConfirming}>
                        <div className={dk.confirm}>
                          {t('settingsSharedSpacePage.confirmExpel', { name: guestName })}
                          <div className={dk.confirmBtns}>
                            <button type="button" className={`${deskStyles.btn} ${deskStyles.btnSoft}`} onClick={() => setConfirmExpel(null)}>{t('buttons.cancel')}</button>
                            <button type="button" className={`${deskStyles.btn} ${dk.btnDanger}`} disabled={expelling} onClick={() => handleExpel(m.id)}>
                              {expelling ? t('settingsSharedSpacePage.expelling') : t('settingsSharedSpacePage.expel')}
                            </button>
                          </div>
                        </div>
                      </Collapse>
                    </div>
                  </Collapse>
                </div>
              )
            })}
          </div>
        </div>

        <div className={sp.col}>
          <div className={`${sp.panel} ${sp.oCode}`}>
            <div className={sp.panelTitle}>{t('settingsSharedSpacePage.accessCodeLabel')}</div>
            <div className={sp.code}>{entry.space.access_code}</div>
            <div className={sp.codeBtns}>
              <button type="button" className={`${deskStyles.btn} ${sp.grow}`} onClick={copyCode}><Copy size={15} />{copied ? t('settingsSharedSpacePage.copied') : t('settingsSharedSpacePage.copyCode')}</button>
              <button type="button" className={sp.iconBtn} disabled={regenerating} onClick={() => setConfirmRegen(v => !v)} aria-label={t('settingsSharedSpacePage.regenerate')}><RefreshCw size={16} /></button>
            </div>
            <Collapse open={!!confirmRegen}>
              <div className={dk.confirm} style={{ marginTop: 12 }}>
                {t('settingsSharedSpacePage.regenConfirm')}
                <div className={dk.confirmBtns}>
                  <button type="button" className={`${deskStyles.btn} ${deskStyles.btnSoft}`} onClick={() => setConfirmRegen(false)}>{t('buttons.cancel')}</button>
                  <button type="button" className={`${deskStyles.btn} ${dk.btnDanger}`} disabled={regenerating} onClick={handleRegenerate}>{t('settingsSharedSpacePage.regenerate')}</button>
                </div>
              </div>
            </Collapse>
            <div className={`${sp.hint} ${remaining > 0 ? '' : sp.hintFull}`}>
              {remaining > 0 ? t('settingsSharedSpacePage.inviteHint', { count: remaining }) : t('settingsSharedSpacePage.spaceFullText')}
            </div>
          </div>

          <div className={`${sp.panel} ${sp.oNotif}`}>
            <div {...switchProps(entry.membership.notify_on_changes)} className={deskStyles.tgl} style={{ paddingTop: 0, paddingBottom: 0 }}
              onClick={() => updateMemberPermissions(entry.membership.id, { notify_on_changes: !entry.membership.notify_on_changes })}>
              <div><b>{t('settingsSharedSpacePage.notifyMeLabel')}</b><span>{t('settingsSharedSpacePage.notifyMeSubOwner')}</span></div>
              <Toggle on={entry.membership.notify_on_changes} />
            </div>
            <NotifOffNotice userId={user?.id} show={entry.membership.notify_on_changes} onGo={onGoNotifications} />
          </div>

          <div className={`${sp.panel} ${sp.oDanger}`}>
            <div className={sp.panelTitle}>{t('settingsSharedSpacePage.deskDanger')}</div>
            <div className={dk.danger}>
              <button type="button" className={dk.dangerRow} onClick={() => setConfirmClear(v => !v)}><Trash2 size={16} />{t('settingsSharedSpacePage.clearDataButton')}</button>
              <Collapse open={!!confirmClear}>
                <div className={dk.confirm}>
                  {t('settingsSharedSpacePage.confirmClearText', { name: entry.space.name })}
                  <div className={dk.confirmBtns}>
                    <button type="button" className={`${deskStyles.btn} ${deskStyles.btnSoft}`} onClick={() => setConfirmClear(false)}>{t('buttons.cancel')}</button>
                    <button type="button" className={`${deskStyles.btn} ${dk.btnDanger}`} disabled={clearing} onClick={handleClearData}>{clearing ? t('settingsSharedSpacePage.clearing') : t('settingsSharedSpacePage.clearAll')}</button>
                  </div>
                </div>
              </Collapse>
              <button type="button" className={dk.dangerRow} onClick={() => { setDangerOpen(true); setDangerPassword(''); setDangerError('') }}><Trash2 size={16} />{t('settingsSharedSpacePage.deleteSpaceButton')}</button>
            </div>
          </div>
        </div>
      </div>
      {modals}
    </>
  )
}
