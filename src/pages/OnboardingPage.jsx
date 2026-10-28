import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { User, CalendarCheck, Wallet, BellRing, UserRound, ArrowRight, Check, AlarmClock, TriangleAlert } from 'lucide-react'
import { getWeekdays, getWeekdaysShort } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { usePushNotifications } from '../hooks/usePushNotifications'
import AmountInput from '../components/AmountInput'
import { CurrencySelect } from '../components/CurrencySelect'
import { getCurrencySymbol } from '../lib/currency'
import styles from './OnboardingPage.module.css'
import { switchProps } from '../lib/a11y'
import { useIsDesktop } from '../hooks/useIsDesktop'

// illustrationSize / illustrationBottom / bodyPaddingTop: mismos defaults
// para los 4 (los que ya se habían ajustado), pero cada paso puede
// sobreescribirlos — no todas las ilustraciones tienen las mismas
// proporciones, y cuando una ilustración sube, el título debe subir la
// misma cantidad para no dejar un hueco vacío entre los dos (pedido
// explícito de Johnatan).
const STEP_META = [
  { key: 'name',   label: 'Tu nombre',           Icon: User,          bg: 'var(--onboarding-step1-bg)', illustration: '/onboarding-illustration-1.png', illustrationBottom: -65, bodyPaddingTop: 85 },
  { key: 'cobro',  label: 'Frecuencia de cobro', Icon: CalendarCheck, bg: 'var(--onboarding-step2-bg)', illustration: '/onboarding-illustration-2.png', illustrationBottom: -55, bodyPaddingTop: 60, deskSize: 280, deskBottom: 4 },
  { key: 'income', label: 'Tu ingreso',          Icon: Wallet,        bg: 'var(--onboarding-step3-bg)', illustration: '/onboarding-illustration-3.png', illustrationBottom: -65, bodyPaddingTop: 85, illustrationSize: 270 },
  { key: 'notifs',  label: 'Notificaciones',      Icon: BellRing, optional: true,      bg: 'var(--onboarding-step4-bg)', illustration: '/onboarding-illustration-4.png', illustrationBottom: -50, bodyPaddingTop: 60, deskSize: 260, deskBottom: 6 },
]

// Defaults (para cualquier paso que no traiga su propio override arriba).
const DEFAULT_ILLUSTRATION_SIZE = 280
const DEFAULT_ILLUSTRATION_BOTTOM = -100
const DEFAULT_BODY_PADDING_TOP = 135

// Escritorio: tamaño/posición de la ilustración que asoma sobre el bloque de
// color del riel (cada paso puede sobreescribir deskSize / deskBottom).
const DESK_ILLUSTRATION_SIZE = 230
const DESK_ILLUSTRATION_BOTTOM = 8

const TOTAL_STEPS = STEP_META.length

// Onda inclinada (cae en diagonal de izquierda a derecha, con crestas y
// valles marcados) — es el borde inferior del bloque de color de cada paso.
// Misma forma para los 4 pasos, solo cambia el color de fondo detrás
// (STEP_META[].bg). viewBox 300x110; el relleno es var(--bg) para que la
// parte de abajo se funda con el fondo real de la app (claro u oscuro).
const WAVE_PATH = 'M0,110 L0,20 C30,-19 60,38 95,38 C135,36 150,73 195,64 C238,58 255,101 300,80 L300,110 Z'

// Regla 30 (JS/CSS timing sync): este valor debe coincidir EXACTO con la
// duración definida en OnboardingPage.module.css para .enterFromRight,
// .enterFromLeft, .exitToLeft y .exitToRight (las 4 a 0.3s / 300ms).
const STEP_TRANSITION_MS = 300

export function OnboardingPage({ userId, onDone }) {
  const { t } = useTranslation()
  const [step,           setStep]           = useState(1)
  const [direction,      setDirection]      = useState('forward')
  const [exitingStep,    setExitingStep]    = useState(null)
  const [initial,        setInitial]        = useState(true)
  const [transitionId,   setTransitionId]   = useState(0)
  const [name,           setName]           = useState('')
  const [nameError,      setNameError]      = useState('')
  // Sin valor por defecto: la persona tiene que elegir su moneda (paso 2).
  const [currency,       setCurrency]       = useState('')
  const [currencyError,  setCurrencyError]  = useState('')
  const [cobroFreq,      setCobroFreq]      = useState('weekly')
  const [cobroWeekday,   setCobroWeekday]   = useState(5)
  const [cobroDay1,      setCobroDay1]      = useState(1)
  const [cobroDay2,      setCobroDay2]      = useState(16)
  const [biweeklyCustom, setBiweeklyCustom] = useState(false)
  const [salaryEnabled,  setSalaryEnabled]  = useState(false)
  const [salaryAmount,   setSalaryAmount]   = useState('')
  // Quincenal personalizado: el 1.er toque elige el primer día, el 2.º el segundo.
  const [biweeklyPick,   setBiweeklyPick]   = useState(0)
  const [saving,         setSaving]         = useState(false)
  const [finishError,    setFinishError]    = useState('')

  const isDesk = useIsDesktop()
  const { subscribe, subscribed } = usePushNotifications(userId)
  const exitTimeoutRef = useRef(null)

  useEffect(() => () => clearTimeout(exitTimeoutRef.current), [])

  // Escritorio: marca html[data-desk-sidebar] (valor 'onboarding', sin margen
  // de sidebar) para heredar radios, campos con fondo y botones en píldora
  // de index.css sin duplicarlos aquí.
  useEffect(() => {
    if (!isDesk) return
    const root = document.documentElement
    root.dataset.deskSidebar = 'onboarding'
    // Sin sesión de app todavía no hay riel: no se reserva su margen izquierdo.
    root.classList.add('auth-screen')
    return () => { delete root.dataset.deskSidebar; root.classList.remove('auth-screen') }
  }, [isDesk])

  function pickBiweeklyDay(d) {
    if (biweeklyPick === 0) { setCobroDay1(d); setCobroDay2(null); setBiweeklyPick(1); return }
    if (d === cobroDay1) return
    setCobroDay1(Math.min(d, cobroDay1)); setCobroDay2(Math.max(d, cobroDay1)); setBiweeklyPick(0)
  }

  async function handleFinish() {
    setSaving(true)
    setFinishError('')
    const updates = {
      name: name.trim(),
      currency,
      cobro_freq:    cobroFreq,
      cobro_weekday: cobroFreq === 'weekly' ? cobroWeekday : null,
      cobro_day1:    cobroFreq !== 'weekly' ? (cobroDay1 ?? 1) : null,
      cobro_day2:    cobroFreq === 'biweekly' ? (cobroDay2 ?? (cobroDay1 === 16 ? 1 : 16)) : null,
      salary_enabled: salaryEnabled,
      salary_amount:  salaryEnabled ? (parseFloat(salaryAmount) || 0) : 0,
      onboarding_completed: true,
    }
    // FIX (agosto 2026): antes era `.update(updates).eq('id', userId)` — si
    // por lo que sea no existía YA una fila en `profiles` para este userId
    // (ej. el trigger de Supabase que crea el perfil al registrarse no
    // corrió, o la fila se perdió), un UPDATE no encuentra nada que
    // actualizar, `.single()` truena con "no rows returned", y como este
    // catch no existía, el onboarding fallaba en silencio: no navegaba a
    // ningún lado, no mostraba ningún error, y la persona se quedaba
    // atorada reintentando sin saber por qué (reportado por una usuaria vía
    // Johnatan: "me saca y que vuelva a iniciar" — no la sacaba en realidad,
    // simplemente el onboarding nunca se completaba y no había forma de
    // saberlo). `.upsert(..., { onConflict: 'id' })` es auto-reparable: crea
    // la fila si no existía, o la actualiza si ya existía — de cualquier
    // forma el onboarding SIEMPRE puede terminar.
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...updates }, { onConflict: 'id' })
      .select().single()
    setSaving(false)
    if (!error) { window.scrollTo(0, 0); onDone(data) }
    else {
      // v0.9.803: el mensaje genérico ocultaba la causa real (RLS, columna
      // inexistente, sesión vencida…). Se deja el código técnico a la vista
      // para poder diagnosticar sin abrir la consola.
      console.error('[onboarding] no se pudo guardar el perfil', error)
      const detail = error.code || error.message || ''
      setFinishError(t('onboardingPage.finishError') + (detail ? ` (${detail})` : ''))
    }
  }

  function goToStep(newStep, dir) {
    clearTimeout(exitTimeoutRef.current)
    setInitial(false)
    setDirection(dir)
    setExitingStep(step)
    setStep(newStep)
    setTransitionId(id => id + 1)
    // El scroll debe arrancar arriba en cada paso — si el usuario se desplazó
    // hacia abajo en un paso largo (ej. quincenal personalizado) y avanza,
    // sin esto el paso nuevo entra con el scroll heredado del anterior y no
    // se ve su parte de arriba (reportado por Johnatan).
    window.scrollTo(0, 0)
    exitTimeoutRef.current = setTimeout(() => setExitingStep(null), STEP_TRANSITION_MS)
  }

  function nextStep() {
    if (step === 1) {
      if (!name.trim()) { setNameError(t('onboardingPage.step1.nameError')); return }
      setNameError('')
    }
    if (step === 3) {
      if (!currency) { setCurrencyError(t('currency.onbError')); return }
      setCurrencyError('')
    }
    if (step < TOTAL_STEPS) goToStep(step + 1, 'forward')
    else handleFinish()
  }

  function prevStep() {
    if (step > 1) goToStep(step - 1, 'backward')
  }

  const currencySymbol = getCurrencySymbol(currency || undefined)

  function renderForm(n) {
    return (
      <>
      {n === 1 && (
        <>
          <h2 className={styles.title}>{t('onboardingPage.step1.titleLine1')}<br />{t('onboardingPage.step1.titleLine2')}</h2>
          <p className={styles.desc}>{t('onboardingPage.step1.desc')}</p>
          <label className="field-label">{t('onboardingPage.step1.nameLabel')}</label>
          <div className={styles.inputWithIcon}>
            <UserRound size={18} className={styles.inputIcon} />
            <input aria-label={t('onboardingPage.step1.namePlaceholder')}
              autoFocus
              className={`field-input ${styles.nameInput} ${nameError ? styles.nameInputError : ''}`}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && nextStep()}
              enterKeyHint="next"
              placeholder={t('onboardingPage.step1.namePlaceholder')}
            />
          </div>
          {nameError && <div className={styles.errorText}>{nameError}</div>}
          {isDesk && (
            <div className={styles.extraCard}>
              <span className={styles.avatar}>{(name.trim()[0] || '?').toUpperCase()}</span>
              <div>
                <div className={styles.extraTitle}>{name.trim() || t('onboardingPage.step1.namePlaceholder')}</div>
                <div className={styles.extraSub}>{t('onboardingPage.desk.namePreview')}</div>
              </div>
            </div>
          )}
        </>
      )}

      {n === 2 && (
        <>
          <h2 className={styles.title}>{t('onboardingPage.step2.title')}</h2>
          <p className={styles.desc}>{t('onboardingPage.step2.desc')}</p>

          <label className="field-label">{t('settingsCobro.frequencyLabel')}</label>
          <div className={styles.chipRow}>
            {[['weekly',t('frequency.weekly')],['biweekly',t('frequency.biweekly')],['monthly',t('frequency.monthly')]].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setCobroFreq(val)}
                className={`${styles.chip} ${styles.chipFlex} ${cobroFreq === val ? styles.chipActive : ''}`}
              >
                {label}
                <small className={styles.chipSub}>{t(`onboardingPage.step2.freqSub.${val}`)}</small>
              </button>
            ))}
          </div>

          {cobroFreq === 'weekly' && (
            <div className={styles.section}>
              <label className="field-label">{t('onboardingPage.step2.weekdayLabel')}</label>
              <div className={styles.weekdayRow}>
                {getWeekdaysShort().map((d, i) => (
                  <button
                    key={i}
                    onClick={() => setCobroWeekday(i)}
                    className={`${styles.chip} ${styles.weekdayChip} ${cobroWeekday === i ? styles.chipActive : ''}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <div className={styles.hintCard}>
                <CalendarCheck size={18} className={styles.hintIcon} />
                <div>
                  {t('onboardingPage.step2.weekdayHint', { weekday: i18n.language === 'en' ? getWeekdays()[cobroWeekday] : getWeekdays()[cobroWeekday].toLowerCase() })}
                </div>
              </div>
            </div>
          )}

          {cobroFreq === 'biweekly' && (
            <div className={styles.section}>
              <label className="field-label">{t('onboardingPage.step2.biweeklyDaysLabel')}</label>
              <div className={`${styles.chipRow} ${biweeklyCustom ? styles.chipRowOpen : ''}`}>
                {[{d1:1,d2:16},{d1:13,d2:28},{d1:15,d2:30}].map(preset => {
                  const active = !biweeklyCustom && cobroDay1 === preset.d1 && cobroDay2 === preset.d2
                  return (
                    <button
                      key={`${preset.d1}-${preset.d2}`}
                      onClick={() => { setBiweeklyCustom(false); setCobroDay1(preset.d1); setCobroDay2(preset.d2) }}
                      className={`${styles.chip} ${styles.presetChip} ${active ? styles.chipActive : ''}`}
                    >
                      {t('settingsCobro.dayPair', { d1: preset.d1, d2: preset.d2 })}
                    </button>
                  )
                })}
                <button
                  onClick={() => setBiweeklyCustom(true)}
                  className={`${styles.chip} ${styles.presetChip} ${biweeklyCustom ? styles.chipActive : ''}`}
                >
                  {t('onboardingPage.step2.custom')}
                </button>
              </div>
              {biweeklyCustom && (
                <>
                  <div className={styles.dayPickHelp}>{t('onboardingPage.step2.pickTwoDays')}</div>
                  <div className={styles.dayGrid} role="group" aria-label={t('onboardingPage.step2.biweeklyDaysLabel')}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <button key={d} type="button" onClick={() => pickBiweeklyDay(d)}
                        aria-pressed={d === cobroDay1 || d === cobroDay2}
                        className={`${styles.dayButton} ${d === cobroDay1 || d === cobroDay2 ? styles.dayButtonActive : ''}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {cobroDay1 && cobroDay2 && (
                <div className={styles.hintCard}>
                  <CalendarCheck size={18} className={styles.hintIcon} />
                  <div>
                    {t('onboardingPage.step2.biweeklyHint', { d1: cobroDay1, d2: cobroDay2 })}
                  </div>
                </div>
              )}
            </div>
          )}

          {cobroFreq === 'monthly' && (
            <div className={styles.section}>
              <label className="field-label">{t('settingsCobro.payDayLabel')}</label>
              <div className={styles.dayGrid} role="group" aria-label={t('settingsCobro.payDayLabel')}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <button key={d} type="button" onClick={() => setCobroDay1(d)}
                    aria-pressed={cobroDay1 === d}
                    className={`${styles.dayButton} ${cobroDay1 === d ? styles.dayButtonActive : ''}`}>
                    {d}
                  </button>
                ))}
              </div>
              {cobroDay1 && (
                <div className={styles.hintCard}>
                  <CalendarCheck size={18} className={styles.hintIcon} />
                  <div>
                    {t('settingsCobro.monthlyHelperPrefix')} <span className={styles.hintHighlight}>{cobroDay1}</span> {t('settingsCobro.monthlyHelperSuffix')}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {n === 3 && (
        <>
          <h2 className={styles.title}>{t('onboardingPage.step3.title')}</h2>
          <p className={styles.desc}>{t('onboardingPage.step3.desc')}</p>
          <label className="field-label">{t('currency.onbLabel')}</label>
          <div className={styles.currencyField}>
                <CurrencySelect value={currency} onChange={v => { setCurrency(v); setCurrencyError('') }} />
              </div>
          {currencyError ? <div className={styles.errorText}>{currencyError}</div> : <p className={styles.desc}>{t('currency.onbHint')}</p>}

          <div {...switchProps(salaryEnabled)} onClick={() => setSalaryEnabled(v => !v)} className={styles.toggleRow}>
            <div>
              <div className={styles.toggleLabel}>{t('onboardingPage.step3.toggleLabel')}</div>
              <div className={styles.toggleSub}>{t('onboardingPage.step3.toggleSub')}</div>
            </div>
            <div className={`toggle-track${salaryEnabled ? ' is-on' : ''}`}>
              <div className={`toggle-thumb${salaryEnabled ? ' is-on' : ''}`} />
            </div>
          </div>
          {salaryEnabled && (
            <div>
              <label className="field-label">{t('onboardingPage.step3.amountLabel')}</label>
              <div className={`${styles.amountWrap} ${currencySymbol.length >= 3 ? styles.amountWrapLong : currencySymbol.length === 2 ? styles.amountWrapMid : ''}`}>
                <span className={styles.currencyPrefix}>{currencySymbol}</span>
                <AmountInput
                  autoFocus value={salaryAmount}
                  onChange={e => setSalaryAmount(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && nextStep()}
                  enterKeyHint="next" placeholder="0.00"
                  className={`field-input ${styles.amountInput}`}
                />
              </div>
            </div>
          )}
          {isDesk && salaryEnabled && parseFloat(salaryAmount) > 0 && (
            <div className={styles.extraCard}>
              <span className={styles.extraIcon}><Wallet size={18} /></span>
              <div>
                <div className={styles.extraTitle}>{currencySymbol}{Number(salaryAmount).toLocaleString()}</div>
                <div className={styles.extraSub}>{t('onboardingPage.desk.incomeSummary', { freq: t(`frequency.${cobroFreq}`).toLowerCase() })}</div>
              </div>
            </div>
          )}
        </>
      )}

      {n === 4 && (
        <>
          <h2 className={styles.title}>{t('onboardingPage.step4.title')}</h2>
          <p className={styles.desc}>{t('onboardingPage.step4.desc')}</p>
          <div {...switchProps(subscribed)}
            onClick={async () => { if (!subscribed) await subscribe() }}
            className={`${styles.toggleRow} ${subscribed ? styles.toggleRowStatic : ''}`}
          >
            <div>
              <div className={styles.toggleLabel}>
                {subscribed ? t('onboardingPage.step4.enabledLabel') : t('onboardingPage.step4.disabledLabel')}
              </div>
              <div className={styles.toggleSub}>
                {subscribed ? t('onboardingPage.step4.enabledSub') : t('onboardingPage.step4.disabledSub')}
              </div>
            </div>
            <div className={`toggle-track${subscribed ? ' is-on' : ''}`}>
              <div className={`toggle-thumb${subscribed ? ' is-on' : ''}`} />
            </div>
          </div>
          {isDesk && (
            <div className={styles.benefits}>
              {[[CalendarCheck, 'cobro'], [AlarmClock, 'soon'], [TriangleAlert, 'overdue']].map(([Ico, k]) => (
                <div key={k} className={styles.extraCard}>
                  <span className={styles.extraIcon}><Ico size={18} /></span>
                  <div>
                    <div className={styles.extraTitle}>{t(`onboardingPage.desk.benefit.${k}.title`)}</div>
                    <div className={styles.extraSub}>{t(`onboardingPage.desk.benefit.${k}.sub`)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {subscribed && (
            <div className={styles.readyBanner}>
              <div className={styles.readyTitle}>{t('onboardingPage.step4.readyTitle')}</div>
              <div className={styles.readyText}>{t('onboardingPage.step4.readyText')}</div>
            </div>
          )}
        </>
      )}
      </>
    )
  }

  function renderStep(n) {
    const meta = STEP_META[n - 1]
    return (
      <div className={styles.stepPanel}>
        <div className={styles.scene} style={{ background: meta.bg }}>
          <svg className={styles.wave} viewBox="0 0 300 110" preserveAspectRatio="none">
            <path d={WAVE_PATH} fill="var(--bg)" />
          </svg>
          <img
            className={styles.illustration}
            src={meta.illustration}
            alt=""
            style={{
              width: meta.illustrationSize ?? DEFAULT_ILLUSTRATION_SIZE,
              height: meta.illustrationSize ?? DEFAULT_ILLUSTRATION_SIZE,
              bottom: meta.illustrationBottom ?? DEFAULT_ILLUSTRATION_BOTTOM,
            }}
          />
        </div>

        <div className={styles.body} style={{ paddingTop: meta.bodyPaddingTop ?? DEFAULT_BODY_PADDING_TOP }}>
          {renderForm(n)}
        </div>
      </div>
    )
  }

  if (isDesk) {
    return (
      <div className={styles.deskRoot}>
        <div className={styles.deskShell}>
          <aside className={styles.rail}>
            <div className={styles.railBrand}>
              <img src="/favicon.svg" alt="" className={styles.railLogo} />
              <span>LunaPay</span>
            </div>

            <ol className={styles.railSteps} aria-label={t('onboardingPage.stepsAria')}>
              {STEP_META.map(({ key }, i) => {
                const s = i + 1
                const done   = s < step
                const active = s === step
                const sub = done ? t('onboardingPage.state.done')
                  : active ? t('onboardingPage.state.current')
                  : STEP_META[i].optional ? t('onboardingPage.state.optional') : t('onboardingPage.state.pending')
                return (
                  <li key={s} className={`${styles.railStep} ${done ? styles.railDone : ''} ${active ? styles.railActive : ''}`}
                      aria-current={active ? 'step' : undefined}>
                    <span className={styles.railDot}>
                      {done ? <Check size={17} strokeWidth={3} /> : s}
                    </span>
                    <span className={styles.railText}>
                      <span className={styles.railLabel}>{t(`onboardingPage.stepNames.${key}`)}</span>
                      <span className={styles.railSub}>{sub}</span>
                    </span>
                  </li>
                )
              })}
            </ol>

            {/* Bloque de color con la ilustración asomando por arriba. Los 4 se
                montan apilados y solo cambia cuál está visible (fundido) —
                así hay entrada y salida (Regla 29). */}
            <div className={styles.railScene} aria-hidden="true">
              {STEP_META.map((meta, i) => (
                <div key={meta.key} className={`${styles.sceneBlock} ${i + 1 === step ? styles.sceneBlockOn : ''}`} style={{ background: meta.bg }}>
                  <img className={styles.sceneImg} src={meta.illustration} alt=""
                    style={{ width: meta.deskSize ?? DESK_ILLUSTRATION_SIZE, bottom: meta.deskBottom ?? DESK_ILLUSTRATION_BOTTOM }} />
                </div>
              ))}
            </div>
          </aside>

          <main className={styles.deskMain}>
            <section className={styles.deskCard}>
              <p className={styles.deskKicker}>{t('onboardingPage.stepOf', { n: step, total: TOTAL_STEPS })}</p>

              <div className={styles.deskViewport}>
                {exitingStep !== null && (
                  <div key={`exit-${transitionId}`} className={`${styles.panelWrap} ${styles.exiting} ${direction === 'forward' ? styles.exitToLeft : styles.exitToRight}`}>
                    <div className={styles.deskBody}>{renderForm(exitingStep)}</div>
                  </div>
                )}
                <div key={`enter-${transitionId}`} className={`${styles.panelWrap} ${!initial ? (direction === 'forward' ? styles.enterFromRight : styles.enterFromLeft) : ''}`}>
                  <div className={styles.deskBody}>{renderForm(step)}</div>
                </div>
              </div>

              <div className={styles.deskFoot}>
                {finishError && <p className={styles.deskFinishError}>{finishError}</p>}
                <div className={styles.deskFootRow}>
                  {step > 1
                    ? <button onClick={prevStep} className="btn-ghost">{t('onboardingPage.back')}</button>
                    : <span />}
                  <button onClick={nextStep} disabled={saving} className={`btn-primary ${styles.continueBtn}`}>
                    {saving
                      ? t('settingsCategories.saving')
                      : step < TOTAL_STEPS
                        ? <>{t('onboardingPage.continue')} <ArrowRight size={17} strokeWidth={2.2} /></>
                        : t('onboardingPage.start')}
                  </button>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>

      {/* Stepper — píldora fija flotando sobre la escena de color (que vive en
          renderStep y se desliza por paso). El stepper NO se desliza: siempre
          en la misma posición, solo cambian los colores de sus dots según el
          paso activo. */}
      <div className={styles.stepper}>
        {STEP_META.map(({ label, Icon }, i) => {
          const s = i + 1
          const done   = s < step
          const active = s === step
          return (
            <div key={s} className={styles.stepperItem}>
              <div className={`${styles.stepperDot} ${done ? styles.dotDone : active ? styles.dotActive : styles.dotUpcoming}`}>
                <Icon size={15} strokeWidth={2} className={styles.stepperIcon} />
              </div>
              {i < TOTAL_STEPS - 1 && (
                <div className={`${styles.stepperLine} ${s < step ? styles.lineDone : ''}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Contenido con animación de entrada/salida por paso (Regla 29) */}
      <div className={styles.viewport}>
        {exitingStep !== null && (
          <div key={`exit-${transitionId}`} className={`${styles.panelWrap} ${styles.exiting} ${direction === 'forward' ? styles.exitToLeft : styles.exitToRight}`}>
            {renderStep(exitingStep)}
          </div>
        )}
        <div key={`enter-${transitionId}`} className={`${styles.panelWrap} ${!initial ? (direction === 'forward' ? styles.enterFromRight : styles.enterFromLeft) : ''}`}>
          {renderStep(step)}
        </div>
      </div>

      {/* Botones */}
      <div className={styles.actions}>
        {finishError && <p className={styles.finishError}>{finishError}</p>}
        <button onClick={nextStep} disabled={saving} className={`btn-primary ${styles.continueBtn}`}>
          {saving
            ? t('settingsCategories.saving')
            : step < TOTAL_STEPS
              ? <>{t('onboardingPage.continue')} <ArrowRight size={17} strokeWidth={2.2} /></>
              : t('onboardingPage.start')}
        </button>
        {step > 1 && (
          <button onClick={prevStep} className="btn-ghost">{t('onboardingPage.back')}</button>
        )}
      </div>
    </div>
  )
}
