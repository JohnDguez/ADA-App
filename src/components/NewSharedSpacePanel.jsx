import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Crown, Users, Receipt, Bell, Plus, Check, LogIn } from 'lucide-react'
import { CurrencySelect } from './CurrencySelect'
import { CobroPeriodFields } from './CobroPeriodFields'
import styles from './NewSharedSpacePanel.module.css'
import dk from './NewSharedSpaceDesk.module.css'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { usePremiumCta } from '../lib/premiumOffer'

// Panel que reemplaza el contenido normal de Inicio/Gastos/Recurrentes
// cuando la tarjeta "Nuevo espacio compartido" del switcher está activa.
// Mismos formularios/textos que `SettingsSharedSpacePage.jsx` (no se
// reinventa el estilo) — con 2 diferencias a propósito, confirmadas por
// Johnatan: (1) el formulario de crear aparece directo, sin el paso extra
// de "Crear Espacio Compartido" → clic → formulario, porque aquí sí hay
// espacio de sobra; (2) el mensaje de "únete con código" dice cuántos
// espacios más puede unirse (dinámico), no solo un tope fijo de 3.
export function NewSharedSpacePanel({ profile, sharedSpaces, onOpenPremium, onCreated, onJoined }) {
  const { t } = useTranslation()
  const premiumCta = usePremiumCta()
  const isDesktop = useIsDesktop()
  const { spaces, createSpace, redeemCode } = sharedSpaces
  const ownedEntry   = spaces.find(s => s.membership.role === 'owner')
  const guestEntries = spaces.filter(s => s.membership.role === 'guest')
  const slotsLeft    = 3 - guestEntries.length

  // ── Crear ──
  const [newName,     setNewName]     = useState('')
  // Sugerida: la moneda personal del dueño; puede elegir otra para el espacio.
  const [newCurrency, setNewCurrency] = useState(profile.currency || '')
  const [newFreq,     setNewFreq]     = useState('biweekly')
  const [newDay1,     setNewDay1]     = useState(1)
  const [newDay2,     setNewDay2]     = useState(16)
  const [newWeekday,  setNewWeekday]  = useState(5)
  const [newWeekendShift, setNewWeekendShift] = useState(null)
  const [createError, setCreateError] = useState('')
  const [createSaving,setCreateSaving]= useState(false)

  async function handleCreate() {
    if (!newName.trim()) { setCreateError(t('newSharedSpacePanel.nameRequiredError')); return }
    if (!newCurrency) { setCreateError(t('currency.spaceRequired')); return }
    setCreateSaving(true)
    setCreateError('')
    const { data, error } = await createSpace({
      name: newName.trim(),
      isPremium: profile.is_premium,
      currency: newCurrency,
      cobroFreq: newFreq,
      cobroDay1: newFreq !== 'weekly' ? newDay1 : undefined,
      cobroDay2: newFreq === 'biweekly' ? newDay2 : undefined,
      cobroWeekday: newFreq === 'weekly' ? newWeekday : undefined,
      weekendShift: newFreq !== 'weekly' ? newWeekendShift : null,
    })
    setCreateSaving(false)
    if (error) setCreateError(typeof error === 'string' ? error : t('newSharedSpacePanel.createGenericError'))
    else { setNewName(''); onCreated && data?.id && onCreated(data.id) }
  }

  // ── Unirse ──
  const [joinCode,   setJoinCode]   = useState('')
  const [joinError,  setJoinError]  = useState('')
  const [joinSaving, setJoinSaving] = useState(false)

  async function handleJoin() {
    if (joinCode.trim().length !== 6) { setJoinError(t('newSharedSpacePanel.joinCodeLengthError')); return }
    setJoinSaving(true)
    setJoinError('')
    const { data, error } = await redeemCode(joinCode.trim())
    setJoinSaving(false)
    if (error) setJoinError(typeof error === 'string' ? error : t('newSharedSpacePanel.joinCodeInvalid'))
    else { setJoinCode(''); onJoined && data?.space_id && onJoined(data.space_id) }
  }

  // ── Escritorio (≥1100px, v0.9.871): dos tarjetas lado a lado ──
  if (isDesktop) {
    const isPremium = !!profile.is_premium
    const perks = [['perk1', Users], ['perk2', Receipt], ['perk3', Bell]]
    return (
      <div className={dk.wrap}>
        <div className={dk.hd}>
          <h2 className={dk.h2}>{t('newSharedSpacePanel.deskTitle')}</h2>
          <p className={dk.p}>{t('newSharedSpacePanel.deskSub')}</p>
        </div>
        <div className={dk.cols}>
          {!isPremium && (
            <div className={dk.card}>
              <div className={dk.ct}>
                <span className={`${dk.ic} ${dk.icGold}`}><Crown size={20} fill="currentColor" /></span>
                <div><b>{t('newSharedSpacePanel.upsellTitle')}</b><span>{t('newSharedSpacePanel.upsellSub')}</span></div>
              </div>
              <div className={dk.row3}>
                {perks.map(([k, Ic]) => (
                  <div className={dk.tile} key={k}>
                    <span className={dk.pi}><Ic size={16} /></span>
                    <div><b>{t(`newSharedSpacePanel.${k}Title`)}</b>{t(`newSharedSpacePanel.${k}Sub`)}</div>
                  </div>
                ))}
              </div>
              <div className={dk.foot}>
                <button type="button" onClick={onOpenPremium} className={`${dk.btn} ${dk.btnGold} ${dk.btnFit}`}>
                  <Crown size={16} fill="currentColor" /> {premiumCta.cta}
                </button>
                {premiumCta.fine && <div className={dk.fine}>{premiumCta.fine}</div>}
              </div>
            </div>
          )}

          {isPremium && !ownedEntry && (
            <div className={dk.card}>
              <div className={dk.ct}>
                <span className={dk.ic}><Plus size={20} strokeWidth={2.4} /></span>
                <div><b>{t('newSharedSpacePanel.createTitle')}</b><span>{t('newSharedSpacePanel.createSub')}</span></div>
              </div>
              <div className={dk.two}>
              <div>
                <label className={dk.lbl}>{t('newSharedSpacePanel.spaceNameLabel')}</label>
                <input aria-label={t('newSharedSpacePanel.spaceNameLabel')} className={`field-input ${dk.input}`} value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('newSharedSpacePanel.spaceNamePlaceholder')} />
              </div>
              <div>
                <label className={dk.lbl}>{t('currency.spaceLabel')}</label>
                <CurrencySelect value={newCurrency} onChange={setNewCurrency} sheetTitle={t('currency.spaceSheetTitle')} />
              </div>
              </div>
              <div>
                <label className={dk.lbl}>{t('cobroPeriodFields.periodLabel')}</label>
                <CobroPeriodFields
                  freq={newFreq} day1={newDay1} day2={newDay2} weekday={newWeekday}
                  onChangeFreq={setNewFreq} onChangeDay1={setNewDay1} onChangeDay2={setNewDay2} onChangeWeekday={setNewWeekday}
                  weekendShift={newWeekendShift} onChangeWeekendShift={setNewWeekendShift}
                />
              </div>
              {createError && <div className={dk.err}>{createError}</div>}
              <button type="button" onClick={handleCreate} disabled={createSaving} className={`${dk.btn} ${dk.btnFit}`}>
                {createSaving ? t('newSharedSpacePanel.creating') : t('newSharedSpacePanel.create')}
              </button>
            </div>
          )}

          {isPremium && ownedEntry && (
            <div className={dk.card}>
              <div className={dk.ct}>
                <span className={dk.ic}><Check size={20} strokeWidth={2.6} /></span>
                <div><b>{t('newSharedSpacePanel.ownedTitle')}</b><span>{t('newSharedSpacePanel.ownedSub')}</span></div>
              </div>
              <div className={dk.okBox}>{t('newSharedSpacePanel.ownedText')}</div>
              {onCreated && ownedEntry.space?.id && (
                <button type="button" onClick={() => onCreated(ownedEntry.space.id)} className={`${dk.btn} ${dk.btnSoft}`}>{t('newSharedSpacePanel.goToSpace')}</button>
              )}
            </div>
          )}

          {slotsLeft > 0 ? (
            <div className={dk.card}>
              <div className={dk.ct}>
                <span className={dk.ic}><LogIn size={20} /></span>
                <div><b>{t('newSharedSpacePanel.joinTitle')}</b><span>{t(isPremium ? 'newSharedSpacePanel.joinSub' : 'newSharedSpacePanel.joinSubFree')}</span></div>
              </div>
              <div className={dk.codeWrap}>
                <div className={dk.code} aria-hidden="true">
                  {Array.from({ length: 6 }, (_, i) => (
                    <i key={i} className={i === Math.min(joinCode.length, 5) ? dk.codeFocus : ''}>{joinCode[i] || ''}</i>
                  ))}
                </div>
                <input aria-label={t('newSharedSpacePanel.codeAria')} className={dk.codeInput} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                  value={joinCode} onChange={e => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={e => { if (e.key === 'Enter' && joinCode.length === 6 && !joinSaving) handleJoin() }} />
              </div>
              <div className={dk.hint}>{t('newSharedSpacePanel.joinText', { count: slotsLeft })}</div>
              {joinError && <div className={dk.err}>{joinError}</div>}
              <button type="button" onClick={handleJoin} disabled={joinSaving || joinCode.length !== 6} className={dk.btn}>
                {joinSaving ? t('newSharedSpacePanel.joining') : t('newSharedSpacePanel.join')}
              </button>
            </div>
          ) : (
            <div className={dk.card}><div className={dk.okBox}>{t('newSharedSpacePanel.maxJoined')}</div></div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      {/* Escenario 1: no Premium */}
      {!profile.is_premium && (
        <div className={styles.card}>
          <div className={styles.premiumCtaTitle}>
            {t('newSharedSpacePanel.premiumCtaTitle')}
          </div>
          <div className={styles.premiumCtaText}>
            {t('newSharedSpacePanel.premiumCtaText')}
          </div>
          <button
            onClick={onOpenPremium}
            className={styles.premiumButton}
          >
            <Crown size={16} fill="currentColor" /> {premiumCta.cta}
          </button>
        </div>
      )}

      {/* Escenario 2: Premium sin espacio propio — formulario directo */}
      {profile.is_premium && !ownedEntry && (
        <div className={styles.createCard}>
          <div className={styles.createTitle}>{t('newSharedSpacePanel.createTitle')}</div>
          <label className="field-label">{t('newSharedSpacePanel.spaceNameLabel')}</label>
          <input aria-label={t('newSharedSpacePanel.spaceNameLabel')} className={`field-input ${styles.fieldGroupMb16}`} value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('newSharedSpacePanel.spaceNamePlaceholder')} />
          <label className={`field-label ${styles.fieldLabelSpaced}`}>{t('currency.spaceLabel')}</label>
          <div className={styles.fieldGroupMb16}>
            <CurrencySelect value={newCurrency} onChange={setNewCurrency} sheetTitle={t('currency.spaceSheetTitle')} />
          </div>
          <label className={`field-label ${styles.fieldLabelSpaced}`}>{t('cobroPeriodFields.periodLabel')}</label>
          <div className={styles.fieldGroupMb16}>
            <CobroPeriodFields
              freq={newFreq} day1={newDay1} day2={newDay2} weekday={newWeekday}
              onChangeFreq={setNewFreq} onChangeDay1={setNewDay1} onChangeDay2={setNewDay2} onChangeWeekday={setNewWeekday}
                  weekendShift={newWeekendShift} onChangeWeekendShift={setNewWeekendShift}
            />
          </div>

          {createError && <div className={styles.errorText}>{createError}</div>}
          <button onClick={handleCreate} disabled={createSaving} className={`btn-primary ${createSaving ? styles.dim70 : ''}`}>
            {createSaving ? t('newSharedSpacePanel.creating') : t('newSharedSpacePanel.create')}
          </button>
        </div>
      )}

      {/* Escenario 3: Premium y ya tiene su espacio propio */}
      {profile.is_premium && ownedEntry && (
        <div className={styles.ownedCard}>
          <div className={styles.ownedText}>
            {t('newSharedSpacePanel.ownedText')}
          </div>
        </div>
      )}

      {/* Unirse con código — siempre visible, para los 3 escenarios */}
      {slotsLeft > 0 ? (
        <div className={styles.joinCard}>
          <div className={styles.joinTitle}>{t('newSharedSpacePanel.joinTitle')}</div>
          <div className={styles.joinText}>
            {t('newSharedSpacePanel.joinText', { count: slotsLeft })}
          </div>
          <input aria-label={t('newSharedSpacePanel.joinTitle')}
            className={`field-input ${styles.joinCodeInput}`} inputMode="numeric" maxLength={6}
            value={joinCode} onChange={e => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
          />
          {joinError && <div className={styles.errorText}>{joinError}</div>}
          <button onClick={handleJoin} disabled={joinSaving || joinCode.length !== 6} className="btn-primary">
            {joinSaving ? t('newSharedSpacePanel.joining') : t('newSharedSpacePanel.join')}
          </button>
        </div>
      ) : (
        <div className={styles.maxJoinedCard}>
          {t('newSharedSpacePanel.maxJoined')}
        </div>
      )}
    </div>
  )
}
