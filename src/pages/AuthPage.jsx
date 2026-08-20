import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, Lock, Mail, KeyRound, X, Check } from 'lucide-react'
import { passwordRequirements, isPasswordStrong } from '../components/PasswordSetupModal'
import Logo from '../components/Logo'
import { APP_NAME } from '../lib/constants'
import { loadGoogleIdentityScript, generateNonce } from '../lib/googleAuth'

// ── Modal de Términos y Condiciones ──────────────────────────────────────────
function TermsModal({ onClose }) {
  const { t } = useTranslation()
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,10,31,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{t('termsModal.title')}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
            <X size={20} color="var(--text)" />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '20px', flex: 1, lineHeight: 1.7, fontSize: 13, color: 'var(--text)' }}>
          <p style={{ marginBottom: 16 }}>{t('termsModal.lastUpdated')}</p>
          <p style={{ marginBottom: 16 }}>{t('termsModal.intro', { appName: APP_NAME })}</p>
          <Section title={t('termsModal.section1Title')}>{t('termsModal.section1Text', { appName: APP_NAME })}</Section>
          <Section title={t('termsModal.section2Title')}>{t('termsModal.section2Text', { appName: APP_NAME })}</Section>
          <Section title={t('termsModal.section3Title')}>{t('termsModal.section3Text', { appName: APP_NAME })}</Section>
          <Section title={t('termsModal.section4Title')}>{t('termsModal.section4Text', { appName: APP_NAME })}</Section>
          <Section title={t('termsModal.section5Title')}>{t('termsModal.section5Text', { appName: APP_NAME })}</Section>
          <Section title={t('termsModal.section6Title')}>{t('termsModal.section6Text', { appName: APP_NAME })}</Section>
          <Section title={t('termsModal.section7Title')}>{t('termsModal.section7Text', { appName: APP_NAME })}</Section>
          <Section title={t('termsModal.section8Title')}>{t('termsModal.section8Text', { appName: APP_NAME })}</Section>
          <Section title={t('termsModal.section9Title')}>{t('termsModal.section9Text', { appName: APP_NAME })}</Section>
          <Section title={t('termsModal.section10Title')}>{t('termsModal.section10Text', { appName: APP_NAME })}</Section>
          <p style={{ marginTop: 16, fontWeight: 600 }}>{t('termsModal.closing')}</p>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--border)', flexShrink: 0 }}>
          <button onClick={onClose} className="btn-primary">{t('recurrentMigrationModal.understood')}</button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <p>{children}</p>
    </div>
  )
}

// ── Indicador de requisitos de contraseña ────────────────────────────────────
function RequirementRow({ met, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <div style={{
        width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
        background: met ? 'var(--paid)' : 'var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background .15s',
      }}>
        {met
          ? <Check size={10} color="#fff" strokeWidth={3} />
          : <X size={10} color="var(--text)" strokeWidth={2.5} />
        }
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
    </div>
  )
}

// ── Reset Password ────────────────────────────────────────────────────────────
export function ResetPasswordPage({ onDone }) {
  const { t } = useTranslation()
  const [newPassword, setNewPassword] = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [showNew,     setShowNew]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const reqs   = passwordRequirements(newPassword)
  const strong = isPasswordStrong(newPassword)
  const match  = newPassword && confirm && newPassword === confirm

  async function handleUpdate() {
    setError('')
    if (!strong) { setError(t('passwordSetupModal.notStrong')); return }
    if (!match)  { setError(t('settingsAccount.editModal.passwordMismatch')); return }
    setLoading(true)
    const hashParams   = new URLSearchParams(window.location.hash.slice(1))
    const accessToken  = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    if (accessToken && refreshToken) {
      await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (error) setError(error.message)
    else { window.location.hash = ''; onDone() }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <Logo />
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t('resetPasswordPage.title')}</div>
        <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 24 }}>{t('resetPasswordPage.subtitle')}</div>
        {error && <div style={{ background: 'var(--danger-soft)', border: '0.5px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}
        <Field label={t('resetPasswordPage.newPasswordLabel')}>
          <FieldIcon><Lock size={15} color="var(--text)" /></FieldIcon>
          <input className="field-input" style={{ paddingLeft: 40, paddingRight: 40 }} type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t('resetPasswordPage.newPasswordPlaceholder')} />
          <EyeBtn show={showNew} onToggle={() => setShowNew(v => !v)} />
        </Field>
        {newPassword.length > 0 && (
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 14, border: '0.5px solid var(--border)' }}>
            <RequirementRow met={reqs.length}    label={t('settingsAccount.editModal.requirementLength')} />
            <RequirementRow met={reqs.uppercase} label={t('settingsAccount.editModal.requirementUppercase')} />
            <RequirementRow met={reqs.number}    label={t('settingsAccount.editModal.requirementNumber')} />
            <RequirementRow met={reqs.symbol}    label={t('settingsAccount.editModal.requirementSymbol')} />
          </div>
        )}
        <Field label={t('passwordSetupModal.confirmLabel')}>
          <FieldIcon><Lock size={15} color="var(--text)" /></FieldIcon>
          <input className="field-input" style={{ paddingLeft: 40, paddingRight: 40, borderColor: confirm && !match ? 'var(--danger)' : undefined }} type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={t('passwordSetupModal.confirmPlaceholder')} onKeyDown={e => e.key === 'Enter' && handleUpdate()} />
          <EyeBtn show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
          {confirm && !match && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{t('settingsAccount.editModal.passwordMismatch')}</div>}
        </Field>
        <button onClick={handleUpdate} disabled={loading || !strong || !match} className="btn-primary" style={{ marginTop: 8, opacity: loading || !strong || !match ? 0.6 : 1 }}>
          {loading ? t('resetPasswordPage.saving') : t('resetPasswordPage.submit')}
        </button>
      </div>
    </div>
  )
}

// ── Auth Page ─────────────────────────────────────────────────────────────────
export function AuthPage() {
  const { t } = useTranslation()
  const [mode,          setMode]          = useState('login')
  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [confirm,       setConfirm]       = useState('')
  const [accessCode,    setAccessCode]    = useState('')
  const [showPass,      setShowPass]      = useState(false)
  const [showConfirm,   setShowConfirm]   = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error,         setError]         = useState('')
  const [success,       setSuccess]       = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showTerms,     setShowTerms]     = useState(false)

  const reqs   = passwordRequirements(password)
  const strong = isPasswordStrong(password)
  const match  = password && confirm && password === confirm

  // ── Google Identity Services (GIS) — ver src/lib/googleAuth.js ────────────
  // google.accounts.id.prompt() se llama DIRECTO desde el onClick real del
  // botón custom — dispara FedCM sin pasar por ningún botón/iframe oculto
  // (ver comentario en googleAuth.js sobre por qué el truco de "botón oculto
  // + click simulado" NO funciona, corregido en v0.9.381).
  const rawNonceRef = useRef('')
  const [googleReady, setGoogleReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function initGoogle() {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
      if (!clientId) { console.error('Falta VITE_GOOGLE_CLIENT_ID'); return }

      await loadGoogleIdentityScript()
      if (cancelled) return

      const { rawNonce, hashedNonce } = await generateNonce()
      rawNonceRef.current = rawNonce

      window.google.accounts.id.initialize({
        client_id: clientId,
        nonce: hashedNonce,
        use_fedcm_for_prompt: true,
        callback: async (response) => {
          setGoogleLoading(true)
          const { error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: response.credential,
            nonce: rawNonceRef.current,
          })
          if (error) setError(t('authPage.errors.wrongCredentials'))
          setGoogleLoading(false)
        },
      })

      setGoogleReady(true)
    }

    initGoogle()
    return () => { cancelled = true }
  }, [])

  function handleGoogle() {
    if (!googleReady) return
    setGoogleLoading(true)
    window.google.accounts.id.prompt((notification) => {
      // Google decidió NO mostrar el prompt (enfriamiento tras cierres
      // repetidos, navegador sin soporte de FedCM, etc.) — caso raro pero
      // real, con respaldo al flujo anterior en vez de dejar el botón sin
      // reaccionar.
      if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
        supabase.auth
          .signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
          .finally(() => setGoogleLoading(false))
      }
    })
  }

  async function handleSubmit() {
    setError(''); setSuccess('')

    if (mode === 'forgot') {
      if (!email) { setError(t('authPage.errors.emptyEmail')); return }
      setLoading(true)
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
      if (error) setError(t('authPage.errors.resetEmailError'))
      else setSuccess(t('authPage.errors.resetEmailSent'))
      setLoading(false); return
    }

    if (!email || !password) { setError(t('authPage.errors.emptyFields')); return }

    if (mode === 'register') {
      if (!termsAccepted) { setError(t('authPage.errors.termsRequired')); return }
      if (!strong) { setError(t('authPage.errors.passwordNotStrongRegister')); return }
      if (!match)  { setError(t('settingsAccount.editModal.passwordMismatch')); return }
      if (!accessCode.trim()) { setError(t('authPage.errors.emptyAccessCode')); return }
      setLoading(true)
      // FIX v0.9.15: se cambia .select('id') por .select('code') — la tabla
      // access_codes no tiene columna `id`, solo `code`, `created_at` y `active`.
      // Supabase devolvía error 400 → data null → "código inválido" aunque existiera.
      const { data: codeData } = await supabase
        .from('access_codes')
        .select('code')
        .eq('code', accessCode.trim().toUpperCase())
        .eq('active', true)
        .single()
      if (!codeData) { setError(t('authPage.errors.invalidAccessCode')); setLoading(false); return }
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setSuccess(t('authPage.errors.accountCreated'))
      setLoading(false); return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(t('authPage.errors.wrongCredentials'))
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <Logo />

        {mode !== 'forgot' && (
          <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 10, padding: 3, marginBottom: 24, border: '0.5px solid var(--border)' }}>
            {[['login',t('authPage.tabs.login')],['register',t('authPage.tabs.register')]].map(([m, label]) => (
              <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: mode === m ? 'var(--accent)' : 'transparent', color: mode === m ? '#fff' : 'var(--text)', fontWeight: mode === m ? 600 : 400, fontSize: 14, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', transition: 'background .15s' }}>
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === 'forgot' && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t('authPage.forgotTitle')}</div>
            <div style={{ fontSize: 14, color: 'var(--text)' }}>{t('authPage.forgotSubtitle')}</div>
          </div>
        )}

        {error   && <div style={{ background: 'var(--danger-soft)', border: '0.5px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}
        {success && <div style={{ background: 'var(--paid-soft)',   border: '0.5px solid var(--paid-border)',   borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 13, color: 'var(--paid)',   marginBottom: 16 }}>{success}</div>}

        <Field label={t('authPage.emailLabel')}>
          <FieldIcon><Mail size={15} color="var(--text)" /></FieldIcon>
          <input autoFocus className="field-input" style={{ paddingLeft: 40 }} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('authPage.emailPlaceholder')} onKeyDown={e => e.key === 'Enter' && handleSubmit()} enterKeyHint="next" />
        </Field>

        {mode !== 'forgot' && (
          <Field label={t('authPage.passwordLabel')}>
            <FieldIcon><Lock size={15} color="var(--text)" /></FieldIcon>
            <input className="field-input" style={{ paddingLeft: 40, paddingRight: 40 }} type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSubmit()} enterKeyHint={mode === 'register' ? 'next' : 'done'} />
            <EyeBtn show={showPass} onToggle={() => setShowPass(v => !v)} />
          </Field>
        )}

        {/* Requisitos de contraseña — solo en registro */}
        {mode === 'register' && password.length > 0 && (
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 14, border: '0.5px solid var(--border)' }}>
            <RequirementRow met={reqs.length}    label={t('settingsAccount.editModal.requirementLength')} />
            <RequirementRow met={reqs.uppercase} label={t('settingsAccount.editModal.requirementUppercase')} />
            <RequirementRow met={reqs.number}    label={t('settingsAccount.editModal.requirementNumber')} />
            <RequirementRow met={reqs.symbol}    label={t('settingsAccount.editModal.requirementSymbol')} />
          </div>
        )}

        {mode === 'register' && (<>
          <Field label={t('passwordSetupModal.confirmLabel')}>
            <FieldIcon><Lock size={15} color="var(--text)" /></FieldIcon>
            <input className="field-input" style={{ paddingLeft: 40, paddingRight: 40, borderColor: confirm && !match ? 'var(--danger)' : undefined }} type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={t('passwordSetupModal.confirmPlaceholder')} enterKeyHint="next" />
            <EyeBtn show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
            {confirm && !match && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{t('settingsAccount.editModal.passwordMismatch')}</div>}
          </Field>
          <Field label={t('authPage.accessCodeLabel')}>
            <FieldIcon><KeyRound size={15} color="var(--text)" /></FieldIcon>
            <input className="field-input" style={{ paddingLeft: 40 }} type="text" value={accessCode} onChange={e => setAccessCode(e.target.value)} placeholder={t('authPage.accessCodePlaceholder')} onKeyDown={e => e.key === 'Enter' && handleSubmit()} enterKeyHint="done" />
          </Field>

          {/* Checkbox de términos */}
          <div onClick={() => setTermsAccepted(v => !v)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1, border: termsAccepted ? 'none' : '1.5px solid var(--border)', background: termsAccepted ? 'var(--accent)' : 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s' }}>
              {termsAccepted && (
                <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                  <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
              {t('authPage.termsPrefix')}{' '}
              <span onClick={e => { e.stopPropagation(); setShowTerms(true) }} style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>
                {t('authPage.termsLink')}
              </span>
              {' '}{t('authPage.termsSuffix')}
            </div>
          </div>
        </>)}

        <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ marginBottom: 12 }}>
          {loading ? t('authPage.submit.loading') : mode === 'login' ? t('authPage.submit.login') : mode === 'register' ? t('authPage.submit.register') : t('authPage.submit.forgot')}
        </button>

        {mode === 'login' && (
          <button onClick={() => { setMode('forgot'); setError(''); setSuccess('') }} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--accent)', cursor: 'pointer', display: 'block', margin: '0 auto 16px', fontFamily: 'DM Sans, sans-serif' }}>
            {t('authPage.forgotPasswordLink')}
          </button>
        )}
        {mode === 'forgot' && (
          <button onClick={() => { setMode('login'); setError(''); setSuccess('') }} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--accent)', cursor: 'pointer', display: 'block', margin: '0 auto 16px', fontFamily: 'DM Sans, sans-serif' }}>
            {t('authPage.backToLogin')}
          </button>
        )}

        {mode !== 'forgot' && (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 16px' }}>
            <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
            <span style={{ fontSize: 12, color: 'var(--text)' }}>{t('authPage.orContinueWith')}</span>
            <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
          </div>
          <button onClick={handleGoogle} disabled={googleLoading || !googleReady} style={{ width: '100%', padding: '11px', background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 14, fontWeight: 500, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', opacity: googleReady ? 1 : 0.6 }}>
            <GoogleIcon />
            {googleLoading ? t('authPage.google.connecting') : 'Google'}
          </button>
          {mode === 'register' && (
            <div style={{ fontSize: 11, color: 'var(--text)', textAlign: 'center', marginTop: 10 }}>
              {t('authPage.google.termsNote')}{' '}
              <span onClick={() => setShowTerms(true)} style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}>
                {t('authPage.termsLink')}
              </span>
            </div>
          )}
        </>)}
      </div>

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ position: 'relative', marginBottom: 14 }}>
      <label className="field-label">{label}</label>
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  )
}

function FieldIcon({ children }) {
  return <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 1, display: 'flex' }}>{children}</div>
}

function EyeBtn({ show, onToggle }) {
  return (
    <button type="button" onClick={onToggle} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
      {show ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
    </button>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}
