import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, Lock, Mail, KeyRound, X } from 'lucide-react'

// ── Modal de Términos y Condiciones ──────────────────────────────────────────
function TermsModal({ onClose }) {
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,10,31,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Términos y Condiciones</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
            <X size={20} color="var(--text)" />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '20px', flex: 1, lineHeight: 1.7, fontSize: 13, color: 'var(--text)' }}>

          <p style={{ marginBottom: 16 }}>Última actualización: junio de 2026</p>

          <p style={{ marginBottom: 16 }}>Bienvenido a <strong>ADA Pay</strong>. Al crear una cuenta, aceptas los presentes Términos y Condiciones de uso. Por favor léelos cuidadosamente antes de continuar.</p>

          <Section title="1. Descripción del servicio">
            ADA Pay es una aplicación de seguimiento personal de pagos y compromisos financieros. Su propósito es ayudarte a organizar y recordar tus pagos según tu periodo de cobro. ADA Pay no es una institución financiera, no gestiona dinero real, no realiza transferencias y no tiene acceso a tus cuentas bancarias.
          </Section>

          <Section title="2. Registro y cuenta">
            Para usar ADA Pay debes crear una cuenta con un correo electrónico válido o mediante tu cuenta de Google. Eres responsable de mantener la confidencialidad de tus credenciales de acceso. Debes ser mayor de 18 años para registrarte.
          </Section>

          <Section title="3. Uso aceptable">
            Te comprometes a usar ADA Pay únicamente para fines personales y lícitos. Queda prohibido usar la aplicación para actividades fraudulentas, suplantar identidades, o intentar vulnerar la seguridad del sistema.
          </Section>

          <Section title="4. Privacidad y datos">
            Los datos que ingresas en ADA Pay (nombre, pagos, montos) se almacenan de forma segura en servidores de Supabase. No vendemos ni compartimos tu información personal con terceros con fines comerciales. Puedes eliminar tu cuenta y tus datos en cualquier momento desde Ajustes.
          </Section>

          <Section title="5. Notificaciones push">
            Si activas las notificaciones, ADA Pay enviará alertas relacionadas con tus pagos registrados. Puedes desactivarlas en cualquier momento desde Ajustes o desde la configuración de tu dispositivo.
          </Section>

          <Section title="6. Limitación de responsabilidad">
            ADA Pay es una herramienta de apoyo personal. No garantizamos que el uso de la aplicación prevenga pagos tardíos, cargos por mora u otras consecuencias financieras. El usuario es el único responsable de sus decisiones financieras.
          </Section>

          <Section title="7. Disponibilidad del servicio">
            Nos esforzamos por mantener el servicio disponible en todo momento, pero no garantizamos disponibilidad ininterrumpida. Podemos realizar mantenimientos o actualizaciones sin previo aviso.
          </Section>

          <Section title="8. Modificaciones">
            Nos reservamos el derecho de modificar estos términos en cualquier momento. Te notificaremos de cambios significativos a través de la aplicación. El uso continuado de ADA Pay tras los cambios implica tu aceptación.
          </Section>

          <Section title="9. Cancelación">
            Puedes dejar de usar ADA Pay y eliminar tu cuenta en cualquier momento. Nos reservamos el derecho de suspender cuentas que violen estos términos.
          </Section>

          <Section title="10. Contacto">
            Si tienes dudas sobre estos términos, puedes contactarnos a través de los canales disponibles en la aplicación.
          </Section>

          <p style={{ marginTop: 16, fontWeight: 600 }}>Al crear tu cuenta, confirmas que has leído y aceptas estos Términos y Condiciones.</p>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--border)', flexShrink: 0 }}>
          <button onClick={onClose} className="btn-primary">Entendido</button>
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

// ── Reset Password ────────────────────────────────────────────────────────────
export function ResetPasswordPage({ onDone }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [showNew,     setShowNew]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  async function handleUpdate() {
    setError('')
    if (!newPassword || newPassword.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (newPassword !== confirm) { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    const hashParams = new URLSearchParams(window.location.hash.slice(1))
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
        <img src="/ADA-Pay-logo.svg" alt="ADA Pay" style={{ width: '50%', maxWidth: 180, display: 'block', margin: '0 auto 40px' }} />
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Nueva contraseña</div>
        <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 24 }}>Elige una contraseña segura para tu cuenta.</div>
        {error && <div style={{ background: 'var(--danger-soft)', border: '0.5px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}
        <Field label="Nueva contraseña">
          <FieldIcon><Lock size={15} color="var(--text)" /></FieldIcon>
          <input className="field-input" style={{ paddingLeft: 40, paddingRight: 40 }} type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          <EyeBtn show={showNew} onToggle={() => setShowNew(v => !v)} />
        </Field>
        <Field label="Confirmar contraseña">
          <FieldIcon><Lock size={15} color="var(--text)" /></FieldIcon>
          <input className="field-input" style={{ paddingLeft: 40, paddingRight: 40, borderColor: confirm && newPassword !== confirm ? 'var(--danger)' : undefined }} type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repite tu contraseña" onKeyDown={e => e.key === 'Enter' && handleUpdate()} />
          <EyeBtn show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
          {confirm && newPassword !== confirm && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Las contraseñas no coinciden</div>}
        </Field>
        <button onClick={handleUpdate} disabled={loading} className="btn-primary" style={{ marginTop: 8 }}>
          {loading ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </div>
    </div>
  )
}

// ── Auth Page ─────────────────────────────────────────────────────────────────
export function AuthPage() {
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

  async function handleGoogle() {
    setGoogleLoading(true)
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    setGoogleLoading(false)
  }

  async function handleSubmit() {
    setError(''); setSuccess('')

    if (mode === 'forgot') {
      if (!email) { setError('Ingresa tu correo electrónico'); return }
      setLoading(true)
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
      if (error) setError('No se pudo enviar el correo. Verifica la dirección.')
      else setSuccess('Revisa tu correo — te enviamos el enlace para restablecer tu contraseña.')
      setLoading(false); return
    }

    if (!email || !password) { setError('Completa todos los campos'); return }

    if (mode === 'register') {
      if (!termsAccepted) { setError('Debes aceptar los Términos y Condiciones para continuar'); return }
      if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
      if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
      if (!accessCode.trim()) { setError('Ingresa tu código de acceso'); return }
      setLoading(true)
      const { data: codeData } = await supabase.from('access_codes').select('id').eq('code', accessCode.trim().toUpperCase()).eq('active', true).single()
      if (!codeData) { setError('Código de acceso inválido o inactivo'); setLoading(false); return }
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setSuccess('¡Cuenta creada! Revisa tu correo para confirmar.')
      setLoading(false); return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Correo o contraseña incorrectos')
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <img src="/ADA-Pay-logo.svg" alt="ADA Pay" style={{ width: '50%', maxWidth: 180, display: 'block', margin: '0 auto 40px' }} />

        {mode !== 'forgot' && (
          <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 10, padding: 3, marginBottom: 24, border: '0.5px solid var(--border)' }}>
            {[['login','Iniciar sesión'],['register','Registrarse']].map(([m, label]) => (
              <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: mode === m ? 'var(--accent)' : 'transparent', color: mode === m ? '#fff' : 'var(--text)', fontWeight: mode === m ? 600 : 400, fontSize: 14, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', transition: 'background .15s' }}>
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === 'forgot' && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Recuperar contraseña</div>
            <div style={{ fontSize: 14, color: 'var(--text)' }}>Te enviaremos un enlace para restablecer tu contraseña.</div>
          </div>
        )}

        {error   && <div style={{ background: 'var(--danger-soft)', border: '0.5px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}
        {success && <div style={{ background: 'var(--paid-soft)',   border: '0.5px solid var(--paid-border)',   borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 13, color: 'var(--paid)',   marginBottom: 16 }}>{success}</div>}

        <Field label="Correo electrónico">
          <FieldIcon><Mail size={15} color="var(--text)" /></FieldIcon>
          <input autoFocus className="field-input" style={{ paddingLeft: 40 }} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" onKeyDown={e => e.key === 'Enter' && handleSubmit()} enterKeyHint="next" />
        </Field>

        {mode !== 'forgot' && (
          <Field label="Contraseña">
            <FieldIcon><Lock size={15} color="var(--text)" /></FieldIcon>
            <input className="field-input" style={{ paddingLeft: 40, paddingRight: 40 }} type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSubmit()} enterKeyHint={mode === 'register' ? 'next' : 'done'} />
            <EyeBtn show={showPass} onToggle={() => setShowPass(v => !v)} />
          </Field>
        )}

        {mode === 'register' && (<>
          <Field label="Confirmar contraseña">
            <FieldIcon><Lock size={15} color="var(--text)" /></FieldIcon>
            <input className="field-input" style={{ paddingLeft: 40, paddingRight: 40, borderColor: confirm && password !== confirm ? 'var(--danger)' : undefined }} type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repite tu contraseña" enterKeyHint="next" />
            <EyeBtn show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
          </Field>
          <Field label="Código de acceso">
            <FieldIcon><KeyRound size={15} color="var(--text)" /></FieldIcon>
            <input className="field-input" style={{ paddingLeft: 40 }} type="text" value={accessCode} onChange={e => setAccessCode(e.target.value)} placeholder="Ej. ADA2024" onKeyDown={e => e.key === 'Enter' && handleSubmit()} enterKeyHint="done" />
          </Field>

          {/* Checkbox de términos */}
          <div
            onClick={() => setTermsAccepted(v => !v)}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20, cursor: 'pointer' }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
              border: termsAccepted ? 'none' : '1.5px solid var(--border)',
              background: termsAccepted ? 'var(--accent)' : 'var(--surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background .15s',
            }}>
              {termsAccepted && (
                <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                  <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
              He leído y acepto los{' '}
              <span
                onClick={e => { e.stopPropagation(); setShowTerms(true) }}
                style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
              >
                Términos y Condiciones
              </span>
              {' '}de uso
            </div>
          </div>
        </>)}

        <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ marginBottom: 12 }}>
          {loading ? 'Cargando…' : mode === 'login' ? 'Iniciar sesión' : mode === 'register' ? 'Crear cuenta' : 'Enviar enlace'}
        </button>

        {mode === 'login' && (
          <button onClick={() => { setMode('forgot'); setError(''); setSuccess('') }} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--accent)', cursor: 'pointer', display: 'block', margin: '0 auto 16px', fontFamily: 'DM Sans, sans-serif' }}>
            ¿Olvidaste tu contraseña?
          </button>
        )}
        {mode === 'forgot' && (
          <button onClick={() => { setMode('login'); setError(''); setSuccess('') }} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--accent)', cursor: 'pointer', display: 'block', margin: '0 auto 16px', fontFamily: 'DM Sans, sans-serif' }}>
            Volver al inicio de sesión
          </button>
        )}

        {mode !== 'forgot' && (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 16px' }}>
            <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
            <span style={{ fontSize: 12, color: 'var(--text)' }}>o continúa con</span>
            <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
          </div>
          <button onClick={handleGoogle} disabled={googleLoading} style={{ width: '100%', padding: '11px', background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 14, fontWeight: 500, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
            <GoogleIcon />
            {googleLoading ? 'Conectando…' : 'Google'}
          </button>
          {mode === 'register' && (
            <div style={{ fontSize: 11, color: 'var(--text)', textAlign: 'center', marginTop: 10 }}>
              Al continuar con Google aceptas nuestros{' '}
              <span onClick={() => setShowTerms(true)} style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}>
                Términos y Condiciones
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
