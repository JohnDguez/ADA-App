import { useEffect, useRef, useState } from 'react'
import { User, CalendarCheck, Wallet, BellRing, UserRound, ArrowRight } from 'lucide-react'
import { WEEKDAYS, WEEKDAYS_SHORT } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { usePushNotifications } from '../hooks/usePushNotifications'
import styles from './OnboardingPage.module.css'

// illustrationSize / illustrationBottom / bodyPaddingTop: mismos defaults
// para los 4 (los que ya se habían ajustado), pero cada paso puede
// sobreescribirlos — no todas las ilustraciones tienen las mismas
// proporciones, y cuando una ilustración sube, el título debe subir la
// misma cantidad para no dejar un hueco vacío entre los dos (pedido
// explícito de Johnatan).
const STEP_META = [
  { label: 'Tu nombre',           Icon: User,          bg: 'var(--onboarding-step1-bg)', illustration: '/onboarding-illustration-1.png', illustrationBottom: -80, bodyPaddingTop: 115 },
  { label: 'Frecuencia de cobro', Icon: CalendarCheck, bg: 'var(--onboarding-step2-bg)', illustration: '/onboarding-illustration-2.png', illustrationBottom: -75, bodyPaddingTop: 110 },
  { label: 'Tu ingreso',          Icon: Wallet,        bg: 'var(--onboarding-step3-bg)', illustration: '/onboarding-illustration-3.png', illustrationBottom: -75, bodyPaddingTop: 110 },
  { label: 'Notificaciones',      Icon: BellRing,      bg: 'var(--onboarding-step4-bg)', illustration: '/onboarding-illustration-4.png', illustrationBottom: -80, bodyPaddingTop: 115 },
]

// Defaults (para cualquier paso que no traiga su propio override arriba).
const DEFAULT_ILLUSTRATION_SIZE = 280
const DEFAULT_ILLUSTRATION_BOTTOM = -100
const DEFAULT_BODY_PADDING_TOP = 135

const TOTAL_STEPS = STEP_META.length

// Onda inclinada (cae en diagonal de izquierda a derecha, con crestas y
// valles marcados) — es el borde inferior del bloque de color de cada paso.
// Misma forma para los 4 pasos, solo cambia el color de fondo detrás
// (STEP_META[].bg). viewBox 300x110; el relleno es var(--bg) para que la
// parte de abajo se funda con el fondo real de la app (claro u oscuro).
const WAVE_PATH = 'M0,110 L0,20 C30,-4 60,36 95,38 C135,40 150,66 195,64 C238,62 255,92 300,80 L300,110 Z'

// Regla 30 (JS/CSS timing sync): este valor debe coincidir EXACTO con la
// duración definida en OnboardingPage.module.css para .enterFromRight,
// .enterFromLeft, .exitToLeft y .exitToRight (las 4 a 0.3s / 300ms).
const STEP_TRANSITION_MS = 300

export function OnboardingPage({ userId, onDone }) {
  const [step,           setStep]           = useState(1)
  const [direction,      setDirection]      = useState('forward')
  const [exitingStep,    setExitingStep]    = useState(null)
  const [initial,        setInitial]        = useState(true)
  const [name,           setName]           = useState('')
  const [nameError,      setNameError]      = useState('')
  const [cobroFreq,      setCobroFreq]      = useState('weekly')
  const [cobroWeekday,   setCobroWeekday]   = useState(5)
  const [cobroDay1,      setCobroDay1]      = useState(1)
  const [cobroDay2,      setCobroDay2]      = useState(16)
  const [biweeklyCustom, setBiweeklyCustom] = useState(false)
  const [salaryEnabled,  setSalaryEnabled]  = useState(false)
  const [salaryAmount,   setSalaryAmount]   = useState('')
  const [saving,         setSaving]         = useState(false)

  const { subscribe, subscribed } = usePushNotifications(userId)
  const exitTimeoutRef = useRef(null)

  useEffect(() => () => clearTimeout(exitTimeoutRef.current), [])

  async function handleFinish() {
    setSaving(true)
    const updates = {
      name: name.trim(),
      cobro_freq:    cobroFreq,
      cobro_weekday: cobroFreq === 'weekly' ? cobroWeekday : null,
      cobro_day1:    cobroFreq !== 'weekly' ? (cobroDay1 ?? 1) : null,
      cobro_day2:    cobroFreq === 'biweekly' ? (cobroDay2 ?? 16) : null,
      salary_enabled: salaryEnabled,
      salary_amount:  salaryEnabled ? (parseFloat(salaryAmount) || 0) : 0,
      onboarding_completed: true,
    }
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single()
    setSaving(false)
    if (!error) onDone(data)
  }

  function goToStep(newStep, dir) {
    clearTimeout(exitTimeoutRef.current)
    setInitial(false)
    setDirection(dir)
    setExitingStep(step)
    setStep(newStep)
    exitTimeoutRef.current = setTimeout(() => setExitingStep(null), STEP_TRANSITION_MS)
  }

  function nextStep() {
    if (step === 1) {
      if (!name.trim()) { setNameError('Escribe tu nombre'); return }
      setNameError('')
    }
    if (step < TOTAL_STEPS) goToStep(step + 1, 'forward')
    else handleFinish()
  }

  function prevStep() {
    if (step > 1) goToStep(step - 1, 'backward')
  }

  function renderStep(n) {
    const meta = STEP_META[n - 1]
    return (
      <div className={styles.stepPanel}>
        <div className={styles.scene} style={{ background: meta.bg }}>
          <svg className={styles.wave} viewBox="0 0 300 110" preserveAspectRatio="none">
            <path d={WAVE_PATH} style={{ fill: 'var(--bg)' }} />
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
          {n === 1 && (
            <>
              <h2 className={styles.title}>¿Cuál es<br />tu nombre?</h2>
              <p className={styles.desc}>Ese nombre verás en tu perfil y ese lo verán los usuarios con quien tengas un espacio compartido.</p>
              <label className="field-label">Tu nombre</label>
              <div className={styles.inputWithIcon}>
                <UserRound size={18} className={styles.inputIcon} />
                <input
                  autoFocus
                  className={`field-input ${styles.nameInput}`}
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && nextStep()}
                  enterKeyHint="next"
                  placeholder="Ej. John Doe"
                  style={{ marginBottom: nameError ? 6 : 0 }}
                />
              </div>
              {nameError && <div className={styles.errorText}>{nameError}</div>}
            </>
          )}

          {n === 2 && (
            <>
              <h2 className={styles.title}>¿Cuándo te pagan?</h2>
              <p className={styles.desc}>Esto nos ayuda a mostrarte qué pagos cubrir con cada periodo.</p>

              <label className="field-label">Frecuencia</label>
              <div className={styles.chipRow}>
                {[['weekly','Semanal'],['biweekly','Quincenal'],['monthly','Mensual']].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setCobroFreq(val)}
                    className={`${styles.chip} ${styles.chipFlex} ${cobroFreq === val ? styles.chipActive : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {cobroFreq === 'weekly' && (
                <div className={styles.section}>
                  <label className="field-label">Día de la semana</label>
                  <div className={styles.weekdayRow}>
                    {WEEKDAYS_SHORT.map((d, i) => (
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
                      Te avisaremos qué pagos cubrir antes de cada <span className={styles.hintHighlight}>{WEEKDAYS[cobroWeekday].toLowerCase()}</span>.
                    </div>
                  </div>
                </div>
              )}

              {cobroFreq === 'biweekly' && (
                <div className={styles.section}>
                  <label className="field-label">Días de quincena</label>
                  <div className={styles.chipRow} style={{ marginBottom: biweeklyCustom ? 12 : 0 }}>
                    {[{label:'1 y 16',d1:1,d2:16},{label:'13 y 28',d1:13,d2:28},{label:'15 y 30',d1:15,d2:30}].map(preset => {
                      const active = !biweeklyCustom && cobroDay1 === preset.d1 && cobroDay2 === preset.d2
                      return (
                        <button
                          key={preset.label}
                          onClick={() => { setBiweeklyCustom(false); setCobroDay1(preset.d1); setCobroDay2(preset.d2) }}
                          className={`${styles.chip} ${styles.presetChip} ${active ? styles.chipActive : ''}`}
                        >
                          {preset.label}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setBiweeklyCustom(true)}
                      className={`${styles.chip} ${styles.presetChip} ${biweeklyCustom ? styles.chipActive : ''}`}
                    >
                      Personalizado
                    </button>
                  </div>
                  {biweeklyCustom && (
                    <div className={styles.twoColRow}>
                      <div className={styles.colField}>
                        <label className={styles.smallLabel}>Día 1 (1–28)</label>
                        <input
                          type="number" min="1" max="28" value={cobroDay1 ?? ''}
                          onChange={e => setCobroDay1(Math.min(28, Math.max(1, parseInt(e.target.value)||1)))}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('cobro-day2')?.focus() } }}
                          enterKeyHint="next" placeholder="ej. 13" className="field-input"
                        />
                      </div>
                      <div className={styles.colField}>
                        <label className={styles.smallLabel}>Día 2 (1–31)</label>
                        <input
                          type="number" min="1" max="31" value={cobroDay2 ?? ''} id="cobro-day2"
                          onChange={e => setCobroDay2(Math.min(31, Math.max(1, parseInt(e.target.value)||1)))}
                          onKeyDown={e => e.key === 'Enter' && nextStep()}
                          enterKeyHint="next" placeholder="ej. 28" className="field-input"
                        />
                      </div>
                    </div>
                  )}
                  {cobroDay1 && cobroDay2 && (
                    <div className={styles.hintCard}>
                      <CalendarCheck size={18} className={styles.hintIcon} />
                      <div>
                        Te avisaremos qué pagos cubrir antes de los días <span className={styles.hintHighlight}>{cobroDay1}</span> y <span className={styles.hintHighlight}>{cobroDay2}</span> de cada mes.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {cobroFreq === 'monthly' && (
                <div className={styles.section}>
                  <label className="field-label">Día de cobro</label>
                  <input
                    type="number" min="1" max="31" value={cobroDay1 ?? ''}
                    onChange={e => setCobroDay1(Math.min(31, Math.max(1, parseInt(e.target.value)||1)))}
                    onKeyDown={e => e.key === 'Enter' && nextStep()}
                    enterKeyHint="next" placeholder="ej. 5" className={`field-input ${styles.monthDayInput}`}
                  />
                  {cobroDay1 && (
                    <div className={styles.hintCard}>
                      <CalendarCheck size={18} className={styles.hintIcon} />
                      <div>
                        Tu periodo de cobro empieza el día <span className={styles.hintHighlight}>{cobroDay1}</span> de cada mes.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {n === 3 && (
            <>
              <h2 className={styles.title}>¿Cuánto ganas por periodo?</h2>
              <p className={styles.desc}>Opcional. Te ayuda a ver cuánto te queda libre después de tus pagos.</p>
              <div onClick={() => setSalaryEnabled(v => !v)} className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>Activar ingreso por periodo</div>
                  <div className={styles.toggleSub}>Puedes cambiarlo después en Perfil</div>
                </div>
                <div className="toggle-track" style={{ background: salaryEnabled ? 'var(--accent)' : 'var(--border)' }}>
                  <div className="toggle-thumb" style={{ left: salaryEnabled ? 19 : 3 }} />
                </div>
              </div>
              {salaryEnabled && (
                <div>
                  <label className="field-label">Monto por periodo</label>
                  <div className={styles.amountWrap}>
                    <span className={styles.currencyPrefix}>$</span>
                    <input
                      autoFocus type="number" value={salaryAmount}
                      onChange={e => setSalaryAmount(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && nextStep()}
                      enterKeyHint="next" placeholder="0.00"
                      className={`field-input ${styles.amountInput}`}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {n === 4 && (
            <>
              <h2 className={styles.title}>¿Quieres recibir recordatorios?</h2>
              <p className={styles.desc}>Te avisaremos cuando un pago esté por vencer o se haya vencido.</p>
              <div
                onClick={async () => { if (!subscribed) await subscribe() }}
                className={styles.toggleRow}
                style={{ cursor: subscribed ? 'default' : 'pointer' }}
              >
                <div>
                  <div className={styles.toggleLabel}>
                    {subscribed ? 'Notificaciones activadas' : 'Activar notificaciones'}
                  </div>
                  <div className={styles.toggleSub}>
                    {subscribed ? 'Recibirás alertas de tus pagos' : 'Puedes activarlas después en Perfil'}
                  </div>
                </div>
                <div className="toggle-track" style={{ background: subscribed ? 'var(--accent)' : 'var(--border)' }}>
                  <div className="toggle-thumb" style={{ left: subscribed ? 19 : 3 }} />
                </div>
              </div>
              {subscribed && (
                <div className={styles.readyBanner}>
                  <div className={styles.readyTitle}>¡Listo!</div>
                  <div className={styles.readyText}>Puedes personalizar qué notificaciones recibir desde Perfil.</div>
                </div>
              )}
            </>
          )}
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
          <div className={`${styles.panelWrap} ${styles.exiting} ${direction === 'forward' ? styles.exitToLeft : styles.exitToRight}`}>
            {renderStep(exitingStep)}
          </div>
        )}
        <div className={`${styles.panelWrap} ${!initial ? (direction === 'forward' ? styles.enterFromRight : styles.enterFromLeft) : ''}`}>
          {renderStep(step)}
        </div>
      </div>

      {/* Botones */}
      <div className={styles.actions}>
        <button onClick={nextStep} disabled={saving} className={`btn-primary ${styles.continueBtn}`}>
          {saving
            ? 'Guardando…'
            : step < TOTAL_STEPS
              ? <>Continuar <ArrowRight size={17} strokeWidth={2.2} /></>
              : '¡Comenzar!'}
        </button>
        {step > 1 && (
          <button onClick={prevStep} className="btn-ghost">Atrás</button>
        )}
      </div>
    </div>
  )
}
