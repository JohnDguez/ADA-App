import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Crown } from 'lucide-react'
import { CobroPeriodFields } from './CobroPeriodFields'
import { Toggle } from './SettingsShared'
import AmountInput from './AmountInput'
import styles from './NewSharedSpacePanel.module.css'

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
  const { spaces, createSpace, redeemCode } = sharedSpaces
  const ownedEntry   = spaces.find(s => s.membership.role === 'owner')
  const guestEntries = spaces.filter(s => s.membership.role === 'guest')
  const slotsLeft    = 3 - guestEntries.length

  // ── Crear ──
  const [newName,     setNewName]     = useState('')
  const [newFreq,     setNewFreq]     = useState('biweekly')
  const [newDay1,     setNewDay1]     = useState(1)
  const [newDay2,     setNewDay2]     = useState(16)
  const [newWeekday,  setNewWeekday]  = useState(5)
  const [newSalaryEnabled, setNewSalaryEnabled] = useState(false)
  const [newSalaryAmount,  setNewSalaryAmount]  = useState('')
  const [createError, setCreateError] = useState('')
  const [createSaving,setCreateSaving]= useState(false)

  async function handleCreate() {
    if (!newName.trim()) { setCreateError(t('newSharedSpacePanel.nameRequiredError')); return }
    setCreateSaving(true)
    setCreateError('')
    const { data, error } = await createSpace({
      name: newName.trim(),
      isPremium: profile.is_premium,
      cobroFreq: newFreq,
      cobroDay1: newFreq !== 'weekly' ? newDay1 : undefined,
      cobroDay2: newFreq === 'biweekly' ? newDay2 : undefined,
      cobroWeekday: newFreq === 'weekly' ? newWeekday : undefined,
      salaryEnabled: newSalaryEnabled,
      salaryAmount: newSalaryEnabled ? (parseFloat(newSalaryAmount) || 0) : null,
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
            <Crown size={16} fill="currentColor" /> {t('goalsPage.premiumBanner.button')}
          </button>
        </div>
      )}

      {/* Escenario 2: Premium sin espacio propio — formulario directo */}
      {profile.is_premium && !ownedEntry && (
        <div className={styles.createCard}>
          <div className={styles.createTitle}>{t('newSharedSpacePanel.createTitle')}</div>
          <label className="field-label">{t('newSharedSpacePanel.spaceNameLabel')}</label>
          <input className={`field-input ${styles.fieldGroupMb16}`} value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('newSharedSpacePanel.spaceNamePlaceholder')} />
          <label className={`field-label ${styles.fieldLabelSpaced}`}>{t('settingsCobro.periodSection')}</label>
          <div className={styles.fieldGroupMb16}>
            <CobroPeriodFields
              freq={newFreq} day1={newDay1} day2={newDay2} weekday={newWeekday}
              onChangeFreq={setNewFreq} onChangeDay1={setNewDay1} onChangeDay2={setNewDay2} onChangeWeekday={setNewWeekday}
            />
          </div>

          <div className={`${styles.toggleRow} ${newSalaryEnabled ? styles.toggleRowMb10 : styles.toggleRowMb14}`} onClick={() => setNewSalaryEnabled(v => !v)}>
            <div>
              <div className={styles.toggleTitle}>{t('settingsCobro.incomeLabel')}</div>
              <div className={styles.toggleSubtitle}>{t('newSharedSpacePanel.incomeToggleSub')}</div>
            </div>
            <Toggle on={newSalaryEnabled} />
          </div>
          {newSalaryEnabled && (
            <div className={styles.fieldGroupMb14}>
              <label className="field-label">{t('paymentModal.amountLabel')}</label>
              <AmountInput value={newSalaryAmount} onChange={e => setNewSalaryAmount(e.target.value)} placeholder="0.00" className="field-input" />
            </div>
          )}

          {createError && <div className={styles.errorText}>{createError}</div>}
          <button onClick={handleCreate} disabled={createSaving} className="btn-primary" style={{ opacity: createSaving ? 0.7 : 1 }}>
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
          <input
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
