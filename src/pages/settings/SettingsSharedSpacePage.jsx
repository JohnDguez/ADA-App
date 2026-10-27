import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Users, Copy, RefreshCw, LogOut, Trash2, Crown, Plus, Pencil, CircleCheck, Banknote, PiggyBank, Target, HandCoins, ArrowDownToLine } from 'lucide-react'
// Ícono del encabezado vía Phosphor Icons (mismo patrón que las demás
// sub-páginas ya migradas, v0.9.442-454) — import directo para tree-shaking real.
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree'
import { PageHero } from '../../components/PageHero'
import { Collapse } from '../../components/Collapse'
import { Card, Row, Toggle } from '../../components/SettingsShared'
import { CobroPeriodFields } from '../../components/CobroPeriodFields'
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
import styles from './SettingsSharedSpacePage.module.css'
import { AvatarImg } from '../../components/AvatarImg'
import { Presence } from '../../components/Presence'
import { kbd, switchProps } from '../../lib/a11y'

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
      className={`${styles.permTile} ${on ? styles.permTileOn : ''}`}>
      <span className={styles.permTileIcon}><Icon size={17} /></span>
      <span className={styles.permTileText}>
        <span className={styles.permTileLabel}>{label}</span>
        <span className={styles.permTileStatus}>{on ? t('settingsSharedSpacePage.permTileOn') : t('settingsSharedSpacePage.permTileOff')}</span>
      </span>
    </button>
  )
}

// Sub-página de Ajustes → "Espacio Compartido". Sirve para 2 casos a la vez,
// para no duplicar el formulario de crear/unirse en otro lugar (ej. la
// tarjeta vacía del selector de Home solo navega aquí):
// - Si el usuario no pertenece a ningún espacio: formulario de crear
//   (solo Premium, máximo 1 propio) y/o unirse con código.
// - Si ya pertenece a alguno: panel de administración (si es dueño) y/o
//   lista de espacios donde es invitado (con opción de salirse).
export function SettingsSharedSpacePage({ profile, user, sharedSpaces, onBack, onOpenPremium, slideClass }) {
  const { t } = useTranslation()
  const desk = useDeskSettings()
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

  const joinSheet = canJoinMore && (
    <BottomSheet open={joinOpen} title={t('newSharedSpacePanel.joinTitle')} onClose={() => setJoinOpen(false)}>
      <div className={styles.joinDescription}>{t('settingsSharedSpacePage.joinDescription')}</div>
      <input aria-label={t('newSharedSpacePanel.joinTitle')}
        className={`field-input ${styles.joinCodeInput}`} inputMode="numeric" maxLength={6}
        value={joinCode} onChange={e => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
      />
      {joinError && <div className={styles.errorText}>{joinError}</div>}
      <button onClick={handleJoin} disabled={joinSaving || joinCode.length !== 6} className={`btn-primary ${(joinSaving || joinCode.length !== 6) ? styles.disabledOpacity : ''}`}>
        {joinSaving ? t('newSharedSpacePanel.joining') : t('newSharedSpacePanel.join')}
      </button>
    </BottomSheet>
  )

  if (desk) {
    return (
      <DeskPage>
        <DeskSettingsHead
          title={t('settingsSharedSpacePage.title')}
          description={t('settingsSharedSpacePage.description')}
          actions={<>
            {canJoinMore && <button type="button" className={`${deskStyles.btn} ${deskStyles.btnSoft}`} onClick={() => { setJoinError(''); setJoinOpen(true) }}><Users size={16} />{t('settingsSharedSpacePage.deskJoin')}</button>}
            {canCreateMore && !creating && <button type="button" className={deskStyles.btn} onClick={() => setCreating(true)}><Plus size={16} />{t('settingsSharedSpacePage.deskNew')}</button>}
          </>}
        />

        {ownedEntry && (
          <OwnedSpacePanel
            entry={ownedEntry} user={user}
            regenerateCode={regenerateCode} updateMemberPermissions={updateMemberPermissions}
            updateSpaceConfig={updateSpaceConfig} removeMember={removeMember}
            deleteSpace={deleteSpace} clearSpaceData={clearSpaceData}
          />
        )}

        {guestEntries.length > 0 && (
          <>
            <div className={`${deskStyles.sec} ${ownedEntry ? '' : deskStyles.secFirst}`}>{t('settingsSharedSpacePage.invitedSpacesLabel')}</div>
            <div className={deskStyles.fill}>
              {guestEntries.map(entry => {
                const cur = getCurrency(entry.space.currency)
                return (
                  <div key={entry.membership.id} className={dk.guest}>
                    <div className={dk.guestTop}>
                      <span>{entry.space.name}</span>
                      <button type="button" className={`${deskStyles.btn} ${deskStyles.btnSoft}`} onClick={() => leaveSpace(entry.membership.id)}><LogOut size={14} />{t('settingsSharedSpacePage.leave')}</button>
                    </div>
                    <div className={dk.guestSub}>
                      {t('settingsSharedSpacePage.period', { freq: getFrequencyLabel(entry.space.cobro_freq) })} · {cur.code} · {t('currency.guestHint')}
                    </div>
                    <div {...switchProps(entry.membership.notify_on_changes)} className={deskStyles.tgl}
                      onClick={() => updateMemberPermissions(entry.membership.id, { notify_on_changes: !entry.membership.notify_on_changes })}>
                      <div><b>{t('settingsSharedSpacePage.notifyMeLabel')}</b><span>{t('settingsSharedSpacePage.notifyMeSubGuest')}</span></div>
                      <Toggle on={entry.membership.notify_on_changes} />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {!ownedEntry && !profile.is_premium && (
          <div className={`${deskStyles.blue} ${dk.cta}`} style={{ marginTop: guestEntries.length ? 18 : 0 }}>
            <Crown size={26} />
            <div className={dk.ctaTitle}>{t('newSharedSpacePanel.premiumCtaTitle')}</div>
            <div className={dk.ctaText}>{t('newSharedSpacePanel.premiumCtaText')}</div>
            <button type="button" className={`${deskStyles.btn} ${deskStyles.btnWhite}`} onClick={onOpenPremium}><Crown size={16} />{t('goalsPage.premiumBanner.button')}</button>
          </div>
        )}

        {!ownedEntry && profile.is_premium && creating && (
          <div className={`${deskStyles.fill} ${dk.form}`}>
            <label className="field-label">{t('newSharedSpacePanel.spaceNameLabel')}</label>
            <input aria-label={t('newSharedSpacePanel.spaceNameLabel')} className="field-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('newSharedSpacePanel.spaceNamePlaceholder')} />
            <label className={`field-label ${dk.field}`}>{t('currency.spaceLabel')}</label>
            <CurrencySelect value={newCurrency} onChange={setNewCurrency} sheetTitle={t('currency.spaceSheetTitle')} />
            <label className={`field-label ${dk.field}`}>{t('cobroPeriodFields.periodLabel')}</label>
            <CobroPeriodFields
              freq={newFreq} day1={newDay1} day2={newDay2} weekday={newWeekday}
              onChangeFreq={setNewFreq} onChangeDay1={setNewDay1} onChangeDay2={setNewDay2} onChangeWeekday={setNewWeekday}
            />
            {createError && <div className={dk.err}>{createError}</div>}
            <div className={deskStyles.actions} style={{ marginTop: 18 }}>
              <button type="button" className={deskStyles.btn} onClick={handleCreate} disabled={createSaving}>{createSaving ? t('newSharedSpacePanel.creating') : t('newSharedSpacePanel.create')}</button>
              <button type="button" className={`${deskStyles.btn} ${deskStyles.btnSoft}`} onClick={() => { setCreating(false); setCreateError('') }}>{t('buttons.cancel')}</button>
            </div>
          </div>
        )}

        {!ownedEntry && profile.is_premium && !creating && guestEntries.length === 0 && (
          <div className={deskStyles.fill}>{t('settingsSharedSpacePage.deskEmpty')}</div>
        )}

        {!canJoinMore && <div className={dk.hint}>{t('newSharedSpacePanel.maxJoined')}</div>}
        {joinSheet}
      </DeskPage>
    )
  }

  return (
    <>
    <div className={`${slideClass} ${styles.pageRoot}`}>
      <PageHero
        icon={UsersThree}
        title={t('settingsSharedSpacePage.title')}
        description={t('settingsSharedSpacePage.description')}
        onBack={onBack}
      />

      {/* ── Tu espacio (si eres dueño) ── */}
      {ownedEntry && (
        <OwnedSpacePanel
          entry={ownedEntry}
          user={user}
          regenerateCode={regenerateCode}
          updateMemberPermissions={updateMemberPermissions}
          updateSpaceConfig={updateSpaceConfig}
          removeMember={removeMember}
          deleteSpace={deleteSpace}
          clearSpaceData={clearSpaceData}
        />
      )}

      {/* ── Espacios donde te invitaron ── */}
      {guestEntries.length > 0 && (
        <div className={styles.guestWrapper}>
          <div className={styles.sectionLabel}>
            {t('settingsSharedSpacePage.invitedSpacesLabel')}
          </div>
          {guestEntries.map(entry => (
            <GuestSpaceRow
              key={entry.membership.id}
              entry={entry}
              onLeave={() => leaveSpace(entry.membership.id)}
              onToggleNotify={() => updateMemberPermissions(entry.membership.id, { notify_on_changes: !entry.membership.notify_on_changes })}
            />
          ))}
        </div>
      )}

      {/* ── Crear (solo si es Premium y no tiene ya uno propio) ── */}
      {!ownedEntry && (
        <Card>
          <div className={styles.cardPadding}>
            {!profile.is_premium ? (
              <div className={styles.premiumBlock}>
                <div className={styles.premiumIcon}><Crown size={22} /></div>
                <div className={styles.premiumTitle}>
                  {t('newSharedSpacePanel.premiumCtaTitle')}
                </div>
                <div className={styles.premiumDescription}>
                  {t('newSharedSpacePanel.premiumCtaText')}
                </div>
                <button onClick={onOpenPremium} className={styles.premiumButton}>
                  <Crown size={16} /> {t('goalsPage.premiumBanner.button')}
                </button>
              </div>
            ) : !creating ? (
              <button onClick={() => setCreating(true)} className={styles.createSpaceButton}>
                <Plus size={16} /> {t('newSharedSpacePanel.createTitle')}
              </button>
            ) : (
              <>
                <label className="field-label">{t('newSharedSpacePanel.spaceNameLabel')}</label>
                <input aria-label={t('newSharedSpacePanel.spaceNameLabel')} className={`field-input ${styles.fieldMb16}`} value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('newSharedSpacePanel.spaceNamePlaceholder')} />
                <label className={`field-label ${styles.labelBlock}`}>{t('currency.spaceLabel')}</label>
                <div className={styles.fieldMb16}>
                  <CurrencySelect value={newCurrency} onChange={setNewCurrency} sheetTitle={t('currency.spaceSheetTitle')} />
                </div>
                <label className={`field-label ${styles.labelBlock}`}>{t('cobroPeriodFields.periodLabel')}</label>
                <div className={styles.fieldMb16}>
                  <CobroPeriodFields
                    freq={newFreq} day1={newDay1} day2={newDay2} weekday={newWeekday}
                    onChangeFreq={setNewFreq} onChangeDay1={setNewDay1} onChangeDay2={setNewDay2} onChangeWeekday={setNewWeekday}
                  />
                </div>
                {createError && <div className={styles.errorText}>{createError}</div>}
                <button onClick={handleCreate} disabled={createSaving} className={`btn-primary ${styles.createConfirmMb} ${createSaving ? styles.savingOpacity : ''}`}>
                  {createSaving ? t('newSharedSpacePanel.creating') : t('newSharedSpacePanel.create')}
                </button>
                <button onClick={() => { setCreating(false); setCreateError('') }} className="btn-ghost">{t('buttons.cancel')}</button>
              </>
            )}
          </div>
        </Card>
      )}

      {!canJoinMore && (
        <Card>
          <div className={styles.joinMaxedCard}>
            {t('newSharedSpacePanel.maxJoined')}
          </div>
        </Card>
      )}
    </div>

      {canJoinMore && (
        <>
          <div className={`${styles.addPillRow} ${desk ? styles.addPillRowDesk : ''}`}>
            <button type="button" onClick={() => { setJoinError(''); setJoinOpen(true) }} className={styles.addPill}>
              <Users size={18} color="var(--surface)" />
              {t('settingsSharedSpacePage.joinFab')}
            </button>
          </div>
          <BottomSheet open={joinOpen} title={t('newSharedSpacePanel.joinTitle')} onClose={() => setJoinOpen(false)}>
            <div className={styles.joinDescription}>{t('settingsSharedSpacePage.joinDescription')}</div>
            <input aria-label={t('newSharedSpacePanel.joinTitle')}
              className={`field-input ${styles.joinCodeInput}`} inputMode="numeric" maxLength={6}
              value={joinCode} onChange={e => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
            />
            {joinError && <div className={styles.errorText}>{joinError}</div>}
            <button onClick={handleJoin} disabled={joinSaving || joinCode.length !== 6} className={`btn-primary ${(joinSaving || joinCode.length !== 6) ? styles.disabledOpacity : ''}`}>
              {joinSaving ? t('newSharedSpacePanel.joining') : t('newSharedSpacePanel.join')}
            </button>
          </BottomSheet>
        </>
      )}
    </>
  )
}

// ── Fila plegable de un espacio donde te invitaron ──────────────────────────
function GuestSpaceRow({ entry, onLeave, onToggleNotify }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={styles.guestRowMargin}>
      <button onClick={() => setExpanded(v => !v)} className={styles.guestRowButton}>
        <div className={styles.guestRowLeft}>
          <Users size={16} color="var(--text)" />
          <span className={styles.guestRowTitle}>{entry.space.name}</span>
        </div>
        {expanded ? <ChevronUp size={16} color="var(--text)" /> : <ChevronDown size={16} color="var(--text)" />}
      </button>

      <Collapse open={expanded}>
        <div className={styles.guestRowBody}>
          <div className={styles.guestRowPeriod}>
            {t('settingsSharedSpacePage.period', { freq: getFrequencyLabel(entry.space.cobro_freq) })}
          </div>
          <div className={styles.guestRowPeriod}>
            {t('currency.spaceLabel')}: {t(`currency.names.${getCurrency(entry.space.currency).code}`)} ({getCurrency(entry.space.currency).code}) · {t('currency.guestHint')}
          </div>
          <div {...switchProps(entry.membership.notify_on_changes)} className={`${styles.notifyRow} ${styles.notifyRowMb}`} onClick={onToggleNotify}>
            <div>
              <div className={styles.notifyRowTitle}>{t('settingsSharedSpacePage.notifyMeLabel')}</div>
              <div className={styles.notifyRowSubtitle}>{t('settingsSharedSpacePage.notifyMeSubGuest')}</div>
            </div>
            <Toggle on={entry.membership.notify_on_changes} />
          </div>
          <button onClick={onLeave} className={styles.smallDangerButton}>
            <LogOut size={12} /> {t('settingsSharedSpacePage.leave')}
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
function OwnedSpacePanel({ entry, user, regenerateCode, updateMemberPermissions, updateSpaceConfig, removeMember, deleteSpace, clearSpaceData }) {
  const { t } = useTranslation()
  const desk = useDeskSettings()
  const [expanded,      setExpanded]      = useState(false)
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
      <CurrencySheet open={currencyOpen} onClose={() => setCurrencyOpen(false)} value={entry.space.currency} onSelect={handleCurrency} title={t('currency.spaceSheetTitle')} />
      <Presence show={!!(dangerOpen)}>{() => (
        <div onClick={e => e.target === e.currentTarget && setDangerOpen(false)} className={styles.deleteModalOverlay}>
          <div className={styles.deleteModalSheet}>
            <div className={styles.deleteModalTitle}>{t('activeSpaceHeader.deleteModal.title')}</div>
            <div className={styles.deleteModalDescription}>
              {t('activeSpaceHeader.deleteModal.description')}
            </div>
            <label className={`field-label ${styles.labelBlock}`}>{t('settingsAccount.dangerModal.confirmLabel')}</label>
            <input aria-label={t('settingsAccount.dangerModal.confirmLabel')}
              type="password" className={`field-input ${styles.deleteModalPasswordInput}`} value={dangerPassword}
              onChange={e => setDangerPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDelete()}
              placeholder="••••••••"
            />
            {dangerError && <div className={styles.errorText}>{dangerError}</div>}
            <button
              onClick={handleDelete}
              disabled={dangerLoading || !dangerPassword}
              className={`${styles.deleteModalConfirmButton} ${(dangerLoading || !dangerPassword) ? styles.savingOpacity : ''}`}
            >
              {dangerLoading ? t('settingsAccount.dangerModal.verifying') : t('activeSpaceHeader.deleteModal.confirmButton')}
            </button>
            <button onClick={() => { setDangerOpen(false); setDangerPassword('') }} className="btn-ghost">{t('buttons.cancel')}</button>
          </div>
        </div>
      )}</Presence>
    </>
  )

  if (desk) {
    const members = entry.space.members?.length ? entry.space.members : guestMembers
    const count = Math.max(members.length, guestMembers.length + 1)
    const nm = m => m.profile?.name || t('settingsSharedSpacePage.guestFallback')
    const remaining = 2 - guestMembers.length
    return (
      <>
        <div className={dk.grid}>
          <div className={dk.col}>
            <div className={`${deskStyles.blue} ${dk.hero}`}>
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

            <div className={deskStyles.fill}>
              <div className={deskStyles.fillTitle}>{t('settingsSharedSpacePage.deskConfig')}</div>
              <div className={dk.cfgRow}>
                <div>
                  <label className={dk.lab}>{t('newSharedSpacePanel.spaceNameLabel')}</label>
                  <input aria-label={t('newSharedSpacePanel.spaceNameLabel')} className="field-input" value={nameInput}
                    onChange={e => setNameInput(e.target.value)} onBlur={handleNameBlur}
                    onKeyDown={e => e.key === 'Enter' && e.target.blur()} />
                </div>
                <div>
                  <label className={dk.lab}>{t('settingsCobro.currencyLabel')}</label>
                  <button type="button" onClick={() => setCurrencyOpen(true)} className={`field-input ${dk.curBtn}`}>
                    {getCurrency(entry.space.currency).code}<ChevronDown size={14} color="var(--text)" />
                  </button>
                </div>
              </div>
              <div className={dk.field}>
                <label className={dk.lab}>{t('cobroPeriodFields.periodLabel')}</label>
                <CobroPeriodFields
                  freq={entry.space.cobro_freq} day1={entry.space.cobro_day1} day2={entry.space.cobro_day2} weekday={entry.space.cobro_weekday}
                  onChangeFreq={v => handleCobroChange({ cobro_freq: v })} onChangeDay1={v => handleCobroChange({ cobro_day1: v })}
                  onChangeDay2={v => handleCobroChange({ cobro_day2: v })} onChangeWeekday={v => handleCobroChange({ cobro_weekday: v })}
                />
              </div>
            </div>

            <div className={deskStyles.fill}>
              <div className={deskStyles.fillTitle}>{t('settingsSharedSpacePage.deskMembersTitle')}</div>
              {guestMembers.length === 0 && <div className={dk.hint}>{t('settingsSharedSpacePage.inviteHint', { count: remaining })}</div>}
              {guestMembers.map(m => {
                const guestName = nm(m)
                const isOpen = openMemberId === m.id
                const isConfirming = confirmExpel === m.id
                const onCount = PERM_KEYS.filter(k => m[k]).length
                return (
                  <div key={m.id} className={dk.member}>
                    <button type="button" className={dk.memberHead} onClick={() => setOpenMemberId(isOpen ? null : m.id)}>
                      <div className={dk.avatar}><AvatarImg src={m.profile?.avatar_url} className={dk.img} fallback={<div className={dk.avatarFb}>{guestName.slice(0, 2).toUpperCase()}</div>} /></div>
                      <div className={dk.memberText}><b>{guestName}</b><span>{t('settingsSharedSpacePage.permSummary', { on: onCount, total: PERM_KEYS.length })}</span></div>
                      <span className={dk.role}>{t('settingsSharedSpacePage.guestFallback')}</span>
                      {isOpen ? <ChevronUp size={16} color="var(--text)" /> : <ChevronDown size={16} color="var(--text)" />}
                    </button>
                    <Collapse open={isOpen}>
                      <div className={dk.perms}>
                        <div className={dk.permLabel}>{t('settingsSharedSpacePage.permGroupPayments')}</div>
                        <div className={dk.permGrid}>
                          {PAYMENT_PERMS.map(({ key, Icon, label }) => (
                            <PermTile key={key} Icon={Icon} label={t(label)} on={!!m[key]} onToggle={() => updateMemberPermissions(m.id, { [key]: !m[key] })} />
                          ))}
                        </div>
                        <div className={dk.permLabel}>{t('settingsSharedSpacePage.permGroupGoals')}</div>
                        <div className={dk.permGrid}>
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

          <div className={dk.col}>
            <div className={deskStyles.fill}>
              <div className={deskStyles.fillTitle}>{t('settingsSharedSpacePage.accessCodeLabel')}</div>
              <div className={dk.code}>{entry.space.access_code}</div>
              <div className={dk.codeBtns}>
                <button type="button" className={`${deskStyles.btn} ${dk.grow}`} onClick={copyCode}><Copy size={15} />{copied ? t('settingsSharedSpacePage.copied') : t('settingsSharedSpacePage.copyCode')}</button>
                <button type="button" className={`${deskStyles.btn} ${deskStyles.btnSoft}`} disabled={regenerating} onClick={() => setConfirmRegen(v => !v)} aria-label={t('settingsSharedSpacePage.regenerate')}><RefreshCw size={15} /></button>
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
              <div className={`${dk.hint} ${remaining > 0 ? '' : dk.full}`}>
                {remaining > 0 ? t('settingsSharedSpacePage.inviteHint', { count: remaining }) : t('settingsSharedSpacePage.spaceFullText')}
              </div>
            </div>

            <div className={deskStyles.fill}>
              <div {...switchProps(entry.membership.notify_on_changes)} className={deskStyles.tgl} style={{ paddingTop: 0, paddingBottom: 0 }}
                onClick={() => updateMemberPermissions(entry.membership.id, { notify_on_changes: !entry.membership.notify_on_changes })}>
                <div><b>{t('settingsSharedSpacePage.notifyMeLabel')}</b><span>{t('settingsSharedSpacePage.notifyMeSubOwner')}</span></div>
                <Toggle on={entry.membership.notify_on_changes} />
              </div>
            </div>

            <div className={deskStyles.fill}>
              <div className={deskStyles.fillTitle}>{t('settingsSharedSpacePage.deskDanger')}</div>
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

  return (
    <>
      <div className={styles.ownedWrapper}>
        <button onClick={() => setExpanded(v => !v)} className={styles.ownedHeaderButton}>
          <div className={styles.ownedHeaderLeft}>
            <Crown size={16} color="var(--premium-gold)" />
            <span className={styles.ownedHeaderTitle}>{entry.space.name}</span>
          </div>
          {expanded ? <ChevronUp size={18} color="var(--text)" /> : <ChevronDown size={18} color="var(--text)" />}
        </button>

        <Collapse open={expanded}>
          <div className={styles.islandStack}>

            {/* ── Isla: configuración del espacio ── */}
            <div className={styles.islandCard}>
              <div className={styles.fieldRow}>
                <div className={styles.nameCurrencyRow}>
                  <div className={styles.nameCol}>
                    <label className={styles.plainLabel}>{t('newSharedSpacePanel.spaceNameLabel')}</label>
                    <input aria-label={t('newSharedSpacePanel.spaceNameLabel')}
                      className="field-input" value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      onBlur={handleNameBlur}
                      onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                    />
                  </div>
                  <div className={styles.currencyCol}>
                    <label className={styles.plainLabel}>{t('settingsCobro.currencyLabel')}</label>
                    <button type="button" onClick={() => setCurrencyOpen(true)} className={`field-input ${styles.currencyButton}`}>
                      {getCurrency(entry.space.currency).code}
                      <ChevronDown size={14} color="var(--text)" />
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.plainLabel}>{t('cobroPeriodFields.periodLabel')}</label>
                <CobroPeriodFields
                  freq={entry.space.cobro_freq}
                  day1={entry.space.cobro_day1}
                  day2={entry.space.cobro_day2}
                  weekday={entry.space.cobro_weekday}
                  onChangeFreq={v => handleCobroChange({ cobro_freq: v })}
                  onChangeDay1={v => handleCobroChange({ cobro_day1: v })}
                  onChangeDay2={v => handleCobroChange({ cobro_day2: v })}
                  onChangeWeekday={v => handleCobroChange({ cobro_weekday: v })}
                />
              </div>

              <div className={`${styles.fieldRow} ${styles.fieldRowLast}`}>
                <label className={styles.plainLabel}>{t('settingsSharedSpacePage.accessCodeLabel')}</label>
                <div className={styles.codeRow}>
                  <div className={styles.codeDisplay}>
                    {entry.space.access_code}
                  </div>
                  <button onClick={copyCode} className={styles.codeIconButton} aria-label={t('settingsSharedSpacePage.copyCode')}>
                    <Copy size={16} color="var(--text)" />
                  </button>
                  <button onClick={() => setConfirmRegen(v => !v)} disabled={regenerating} className={`${styles.codeIconButton} ${regenerating ? styles.disabledOpacity : ''}`} aria-label={t('settingsSharedSpacePage.regenerate')}>
                    <RefreshCw size={16} color="var(--text)" />
                  </button>
                </div>
                <Collapse open={!!(confirmRegen)}>
                  <div className={styles.regenConfirm}>
                    <div className={styles.confirmBoxText}>{t('settingsSharedSpacePage.regenConfirm')}</div>
                    <div className={styles.confirmButtonsRow}>
                      <button onClick={() => setConfirmRegen(false)} className={styles.confirmCancelButton}>{t('buttons.cancel')}</button>
                      <button onClick={handleRegenerate} disabled={regenerating} className={`${styles.confirmDangerButton} ${regenerating ? styles.savingOpacity : ''}`}>
                        {t('settingsSharedSpacePage.regenerate')}
                      </button>
                    </div>
                  </div>
                </Collapse>
                {copied && <div className={styles.copiedText}>{t('settingsSharedSpacePage.copied')}</div>}
                {(() => {
                  const remaining = 2 - guestMembers.length
                  if (remaining > 0) {
                    return <div className={styles.inviteHintText}>{t('settingsSharedSpacePage.inviteHint', { count: remaining })}</div>
                  }
                  return <div className={styles.spaceFullText}>{t('settingsSharedSpacePage.spaceFullText')}</div>
                })()}
              </div>
            </div>

            {/* ── Isla: notificaciones del dueño ── */}
            <div className={styles.islandCard}>
              <div className={`${styles.fieldRow} ${styles.fieldRowLast}`}>
                <div {...switchProps(entry.membership.notify_on_changes)} className={styles.notifyRow} onClick={() => updateMemberPermissions(entry.membership.id, { notify_on_changes: !entry.membership.notify_on_changes })}>
                  <div>
                    <div className={styles.notifyRowTitle}>{t('settingsSharedSpacePage.notifyMeLabel')}</div>
                    <div className={styles.notifyRowSubtitle}>{t('settingsSharedSpacePage.notifyMeSubOwner')}</div>
                  </div>
                  <Toggle on={entry.membership.notify_on_changes} />
                </div>
              </div>
            </div>

            {/* ── Isla por cada invitado (colapsado: resumen; al tocar, permisos) ── */}
            {guestMembers.length > 0 && guestMembers.map((m) => {
              const guestName = m.profile?.name || t('settingsSharedSpacePage.guestFallback')
              const initials = guestName.slice(0, 2).toUpperCase()
              const isConfirming = confirmExpel === m.id
              const isOpen = openMemberId === m.id
              const onCount = PERM_KEYS.filter(k => m[k]).length
              return (
                <div key={m.id} className={styles.islandCard}>
                  <button type="button" onClick={() => setOpenMemberId(isOpen ? null : m.id)} className={styles.memberHeaderButton}>
                    <AvatarImg
                      src={m.profile?.avatar_url}
                      className={styles.memberAvatarImg}
                      fallback={<div className={styles.memberAvatarFallback}>{initials}</div>}
                    />
                    <div className={styles.memberTextCol}>
                      <span className={styles.memberName}>{guestName}</span>
                      <span className={styles.memberSummary}>{t('settingsSharedSpacePage.permSummary', { on: onCount, total: PERM_KEYS.length })}</span>
                    </div>
                    {isOpen ? <ChevronUp size={16} color="var(--text)" /> : <ChevronDown size={16} color="var(--text)" />}
                  </button>

                  <Collapse open={isOpen}>
                    <>
                      {/* v0.9.807: permisos como fichas (mismo patrón que las de Notificaciones). */}
                      <div className={styles.permGroupLabel}>{t('settingsSharedSpacePage.permGroupPayments')}</div>
                      <div className={styles.permTiles}>
                        {PAYMENT_PERMS.map(({ key, Icon, label }) => (
                          <PermTile key={key} Icon={Icon} label={t(label)} on={!!m[key]}
                            onToggle={() => updateMemberPermissions(m.id, { [key]: !m[key] })} />
                        ))}
                      </div>
                      <div className={styles.permGroupLabel}>{t('settingsSharedSpacePage.permGroupGoals')}</div>
                      <div className={styles.permTiles}>
                        {GOAL_PERMS.map(({ key, Icon, label, sub }) => (
                          <PermTile key={key} Icon={Icon} label={t(label)} sub={sub ? t(sub) : undefined} on={!!m[key]}
                            onToggle={() => updateMemberPermissions(m.id, { [key]: !m[key] })} />
                        ))}
                      </div>

                      <button onClick={() => setConfirmExpel(isConfirming ? null : m.id)} className={`${styles.dangerButtonRow} ${styles.dangerButtonRowTop} ${isConfirming ? '' : styles.dangerButtonRowLast}`}>
                        <LogOut size={16} color="var(--danger)" />
                        <span className={styles.dangerButtonText}>{t('settingsSharedSpacePage.removeFromSpace')}</span>
                      </button>
                      <Collapse open={!!(isConfirming)}>
                        <div className={styles.confirmBoxWrapper}>
                          <div className={styles.confirmBoxInner}>
                            <div className={styles.confirmBoxText}>
                              {t('settingsSharedSpacePage.confirmExpel', { name: guestName })}
                            </div>
                            <div className={styles.confirmButtonsRow}>
                              <button onClick={() => setConfirmExpel(null)} className={styles.confirmCancelButton}>
                                {t('buttons.cancel')}
                              </button>
                              <button onClick={() => handleExpel(m.id)} disabled={expelling} className={`${styles.confirmDangerButton} ${expelling ? styles.savingOpacity : ''}`}>
                                {expelling ? t('settingsSharedSpacePage.expelling') : t('settingsSharedSpacePage.expel')}
                              </button>
                            </div>
                          </div>
                        </div>
                      </Collapse>
                    </>
                  </Collapse>
                </div>
              )
            })}

            {/* ── Isla: zona de peligro ── */}
            <div className={styles.islandCard}>
              <button onClick={() => setConfirmClear(v => !v)} className={styles.dangerButtonRow}>
                <Trash2 size={16} color="var(--danger)" />
                <span className={styles.dangerButtonText}>{t('settingsSharedSpacePage.clearDataButton')}</span>
              </button>
              <Collapse open={!!(confirmClear)}>
                <div className={styles.confirmBoxWrapper}>
                  <div className={styles.confirmBoxInner}>
                    <div className={styles.confirmBoxText}>
                      {t('settingsSharedSpacePage.confirmClearText', { name: entry.space.name })}
                    </div>
                    <div className={styles.confirmButtonsRow}>
                      <button onClick={() => setConfirmClear(false)} className={styles.confirmCancelButton}>
                        {t('buttons.cancel')}
                      </button>
                      <button onClick={handleClearData} disabled={clearing} className={`${styles.confirmDangerButton} ${clearing ? styles.savingOpacity : ''}`}>
                        {clearing ? t('settingsSharedSpacePage.clearing') : t('settingsSharedSpacePage.clearAll')}
                      </button>
                    </div>
                  </div>
                </div>
              </Collapse>

              <button onClick={() => { setDangerOpen(true); setDangerPassword(''); setDangerError('') }} className={`${styles.dangerButtonRow} ${styles.dangerButtonRowLast}`}>
                <Trash2 size={16} color="var(--danger)" />
                <span className={styles.dangerButtonText}>{t('settingsSharedSpacePage.deleteSpaceButton')}</span>
              </button>
            </div>

          </div>
        </Collapse>
      </div>

      {modals}
    </>
  )
}
