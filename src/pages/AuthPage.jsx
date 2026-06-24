import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Mail, Lock, Eye, EyeOff, KeyRound } from 'lucide-react'

export function ResetPasswordPage({ onDone }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleUpdate() {
    setError('')
    if (newPassword.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (newPassword !== confirm) { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      if (error.message?.includes('expired') || error.message?.includes('invalid')) {
        setError('El enlace expiró o ya fue usado. Solicita uno nuevo desde "¿Olvidaste tu contraseña?"')
      } else {
        setError('No se pudo actualizar la contraseña. Intenta de nuevo.')
      }
      setLoading(false); return
    }
    setSuccess('Contraseña actualizada correctamente')
    setTimeout(async () => { await supabase.auth.signOut(); onDone() }, 1800)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/ADA-Pay-logo.svg" alt="ADA Pay" style={{ height: 160, marginBottom: 8 }} />
        </div>
        {error && <Alert type="danger">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}
        <Field label="Nueva contraseña">
          <FieldIcon><Lock size={15} color="var(--muted)" /></FieldIcon>
          <input className="field-input" style={{ paddingLeft: 40, paddingRight: 40 }} type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          <EyeBtn show={showNew} onToggle={() => setShowNew(v => !v)} />
        </Field>
        <Field label="Confirmar contraseña">
          <FieldIcon><Lock size={15} color="var(--muted)" /></FieldIcon>
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

export function AuthPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleGoogle() {
    setGoogleLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
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
    if (mode === 'register') {
      if (!accessCode.trim()) { setError('Ingresa el código de acceso'); return }
      if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
      if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
      setLoading(true)
      const { data: codeData, error: codeError } = await supabase.from('access_codes').select('code,active').eq('code', accessCode.trim().toUpperCase()).eq('active', true).single()
      if (codeError || !codeData) { setError('Código de acceso inválido. Solicítalo al administrador.'); setLoading(false); return }
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setSuccess('Cuenta creada. Ya puedes iniciar sesión.')
      setLoading(false); return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Correo o contraseña incorrectos')
    setLoading(false)
  }

  function switchMode(m) { setMode(m); setError(''); setSuccess(''); setPassword(''); setConfirm(''); setAccessCode('') }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/ADA-Pay-logo.svg" alt="ADA Pay" style={{ height: 160, marginBottom: 4 }} />
        </div>

        {mode !== 'forgot' && (
          <div style={{ display: 'flex', background: 'var(--border)', borderRadius: 10, padding: 3, marginBottom: 20 }}>
            {[['login','Iniciar sesión'],['register','Crear cuenta']].map(([m, label]) => (
              <button key={m} onClick={() => switchMode(m)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: mode === m ? 'var(--surface)' : 'transparent', color: mode === m ? 'var(--text)' : 'var(--muted)', fontWeight: mode === m ? 600 : 400, fontSize: 14, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>{label}</button>
            ))}
          </div>
        )}

        {mode === 'forgot' && (
          <div style={{ marginBottom: 20 }}>
            <button onClick={() => switchMode('login')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 14, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: 0, marginBottom: 16 }}>← Volver al inicio de sesión</button>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Restablecer contraseña</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Te enviaremos un enlace a tu correo para crear una nueva contraseña.</div>
          </div>
        )}

        {error && <Alert type="danger">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        {/* Botón Google — solo en login y register */}
        {mode !== 'forgot' && (
          <>
            <button onClick={handleGoogle} disabled={googleLoading} style={{ width: '100%', padding: '11px 0', background: 'var(--surface)', color: 'var(--text)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 500, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16, opacity: googleLoading ? 0.7 : 1 }}>
              <GoogleIcon />
              {googleLoading ? 'Redirigiendo…' : mode === 'login' ? 'Continuar con Google' : 'Registrarse con Google'}
            </button>
            <Divider />
          </>
        )}

        <Field label="Correo electrónico">
          <FieldIcon><Mail size={15} color="var(--muted)" /></FieldIcon>
          <input className="field-input" style={{ paddingLeft: 40 }} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
        </Field>

        {mode !== 'forgot' && (
          <Field label="Contraseña">
            <FieldIcon><Lock size={15} color="var(--muted)" /></FieldIcon>
            <input className="field-input" style={{ paddingLeft: 40, paddingRight: 40 }} type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" onKeyDown={e => e.key === 'Enter' && mode === 'login' && handleSubmit()} />
            <EyeBtn show={showPass} onToggle={() => setShowPass(v => !v)} />
          </Field>
        )}

        {mode === 'register' && (
          <>
            <Field label="Confirmar contraseña">
              <FieldIcon><Lock size={15} color="var(--muted)" /></FieldIcon>
              <input className="field-input" style={{ paddingLeft: 40, paddingRight: 40, borderColor: confirm && password !== confirm ? 'var(--danger)' : undefined }} type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repite tu contraseña" />
              <EyeBtn show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
              {confirm && password !== confirm && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Las contraseñas no coinciden</div>}
            </Field>
            <Field label="Código de acceso">
              <FieldIcon><KeyRound size={15} color="var(--muted)" /></FieldIcon>
              <input className="field-input" style={{ paddingLeft: 40, textTransform: 'uppercase', letterSpacing: '0.1em' }} type="text" value={accessCode} onChange={e => setAccessCode(e.target.value.toUpperCase())} placeholder="Código de invitación" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </Field>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: -8, marginBottom: 12 }}>Solicita el código al administrador de la app.</div>
          </>
        )}

        <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ marginTop: 8 }}>
          {loading ? 'Cargando…' : mode === 'login' ? 'Entrar' : mode === 'forgot' ? 'Enviar enlace' : 'Crear cuenta'}
        </button>

        {mode === 'login' && (
          <button onClick={() => switchMode('forgot')} style={{ width: '100%', marginTop: 14, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            ¿Olvidaste tu contraseña?
          </button>
        )}
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>o continúa con correo</span>
      <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
    </div>
  )
}

function Alert({ type, children }) {
  const styles = {
    danger: { bg: 'var(--danger-soft)', border: 'var(--danger-border)', color: 'var(--danger)' },
    success: { bg: 'var(--paid-soft)', border: 'var(--paid-border)', color: 'var(--paid)' },
  }[type]
  return <div style={{ background: styles.bg, border: `0.5px solid ${styles.border}`, borderRadius: 'var(--radius-sm)', padding: '10px 13px', fontSize: 13, color: styles.color, marginBottom: 14 }}>{children}</div>
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label className="field-label">{label}</label>
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  )
}
function FieldIcon({ children }) {
  return <div style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>{children}</div>
}
function EyeBtn({ show, onToggle }) {
  return (
    <button onClick={onToggle} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2 }}>
      {show ? <EyeOff size={15} color="var(--muted)" /> : <Eye size={15} color="var(--muted)" />}
    </button>
  )
}
