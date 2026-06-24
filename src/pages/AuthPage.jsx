import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Mail, Lock, User, Eye, EyeOff, KeyRound } from 'lucide-react'

const INPUT = { width: '100%', padding: '11px 13px 11px 40px', border: '0.5px solid #E4E2DC', borderRadius: 8, fontFamily: 'DM Sans, sans-serif', fontSize: 15, background: '#F7F6F3', color: '#1A1915', outline: 'none' }

export function ResetPasswordPage({ onDone }) {
  const [newPassword, setNewPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleUpdate() {
    if (newPassword.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setError('No se pudo actualizar la contraseña'); setLoading(false); return }
    setSuccess('Contraseña actualizada correctamente')
    setTimeout(async () => {
      await supabase.auth.signOut()
      onDone()
    }, 1800)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#F7F6F3' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, background: '#1E6B45', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1A1915', marginBottom: 4 }}>Nueva contraseña</h1>
          <p style={{ fontSize: 14, color: '#5C5A55' }}>Escribe tu nueva contraseña para continuar.</p>
        </div>
        {error && <div style={{ background: '#FCDEDE', border: '0.5px solid #F5BABA', borderRadius: 8, padding: '10px 13px', fontSize: 13, color: '#B83232', marginBottom: 14 }}>{error}</div>}
        {success && <div style={{ background: '#EAF4EE', border: '0.5px solid #C5E0CF', borderRadius: 8, padding: '10px 13px', fontSize: 13, color: '#1E6B45', marginBottom: 14 }}>{success}</div>}
        <Field label="Nueva contraseña">
          <FieldIcon><Lock size={15} color="#5C5A55" /></FieldIcon>
          <input style={{ ...INPUT, paddingRight: 40 }} type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" onKeyDown={e => e.key === 'Enter' && handleUpdate()} />
          <EyeBtn show={showNew} onToggle={() => setShowNew(v => !v)} />
        </Field>
        <button onClick={handleUpdate} disabled={loading} style={{ width: '100%', padding: 13, background: '#1E6B45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', marginTop: 8, opacity: loading ? 0.7 : 1, cursor: 'pointer' }}>
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
  const [name, setName] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
      if (!name.trim()) { setError('Escribe tu nombre'); return }
      if (!accessCode.trim()) { setError('Ingresa el código de acceso'); return }
      if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
      if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
      setLoading(true)
      const { data: codeData, error: codeError } = await supabase
        .from('access_codes').select('code,active').eq('code', accessCode.trim().toUpperCase()).eq('active', true).single()
      if (codeError || !codeData) { setError('Código de acceso inválido. Solicítalo al administrador.'); setLoading(false); return }
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } })
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#F7F6F3' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, background: '#1E6B45', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 600, color: '#1A1915', marginBottom: 4 }}>Ada</h1>
          <p style={{ fontSize: 14, color: '#5C5A55' }}>Controla tus pagos, sin sorpresas.</p>
        </div>

        {mode !== 'forgot' && (
          <div style={{ display: 'flex', background: '#EDEAE4', borderRadius: 10, padding: 3, marginBottom: 24 }}>
            {[['login','Iniciar sesión'],['register','Crear cuenta']].map(([m, label]) => (
              <button key={m} onClick={() => switchMode(m)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: mode === m ? '#fff' : 'transparent', color: mode === m ? '#1A1915' : '#5C5A55', fontWeight: mode === m ? 600 : 400, fontSize: 14, fontFamily: 'DM Sans, sans-serif', boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', cursor: 'pointer' }}>{label}</button>
            ))}
          </div>
        )}

        {mode === 'forgot' && (
          <div style={{ marginBottom: 20 }}>
            <button onClick={() => switchMode('login')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#5C5A55', fontSize: 14, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: 0, marginBottom: 16 }}>← Volver al inicio de sesión</button>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1A1915', marginBottom: 4 }}>Restablecer contraseña</div>
            <div style={{ fontSize: 13, color: '#5C5A55' }}>Te enviaremos un enlace a tu correo para crear una nueva contraseña.</div>
          </div>
        )}

        {error && <div style={{ background: '#FCDEDE', border: '0.5px solid #F5BABA', borderRadius: 8, padding: '10px 13px', fontSize: 13, color: '#B83232', marginBottom: 14 }}>{error}</div>}
        {success && <div style={{ background: '#EAF4EE', border: '0.5px solid #C5E0CF', borderRadius: 8, padding: '10px 13px', fontSize: 13, color: '#1E6B45', marginBottom: 14 }}>{success}</div>}

        {mode === 'register' && (
          <Field label="Nombre">
            <FieldIcon><User size={15} color="#5C5A55" /></FieldIcon>
            <input style={INPUT} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre completo" />
          </Field>
        )}

        <Field label="Correo electrónico">
          <FieldIcon><Mail size={15} color="#5C5A55" /></FieldIcon>
          <input style={INPUT} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
        </Field>

        {mode !== 'forgot' && (
          <Field label="Contraseña">
            <FieldIcon><Lock size={15} color="#5C5A55" /></FieldIcon>
            <input style={{ ...INPUT, paddingRight: 40 }} type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" onKeyDown={e => e.key === 'Enter' && mode === 'login' && handleSubmit()} />
            <EyeBtn show={showPass} onToggle={() => setShowPass(v => !v)} />
          </Field>
        )}

        {mode === 'register' && (
          <>
            <Field label="Confirmar contraseña">
              <FieldIcon><Lock size={15} color="#5C5A55" /></FieldIcon>
              <input style={{ ...INPUT, paddingRight: 40, borderColor: confirm && password !== confirm ? '#B83232' : '#E4E2DC' }} type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repite tu contraseña" />
              <EyeBtn show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
              {confirm && password !== confirm && <div style={{ fontSize: 11, color: '#B83232', marginTop: 4 }}>Las contraseñas no coinciden</div>}
            </Field>
            <Field label="Código de acceso">
              <FieldIcon><KeyRound size={15} color="#5C5A55" /></FieldIcon>
              <input style={{ ...INPUT, textTransform: 'uppercase', letterSpacing: '0.1em' }} type="text" value={accessCode} onChange={e => setAccessCode(e.target.value.toUpperCase())} placeholder="Código de invitación" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </Field>
            <div style={{ fontSize: 11, color: '#5C5A55', marginTop: -8, marginBottom: 12 }}>Solicita el código al administrador de la app.</div>
          </>
        )}

        <button onClick={handleSubmit} disabled={loading} style={{ width: '100%', padding: 13, background: '#1E6B45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', marginTop: 8, opacity: loading ? 0.7 : 1, cursor: 'pointer' }}>
          {loading ? 'Cargando…' : mode === 'login' ? 'Entrar' : mode === 'forgot' ? 'Enviar enlace' : 'Crear cuenta'}
        </button>

        {mode === 'login' && (
          <button onClick={() => switchMode('forgot')} style={{ width: '100%', marginTop: 14, background: 'none', border: 'none', color: '#5C5A55', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            ¿Olvidaste tu contraseña?
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#5C5A55', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</label>
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
      {show ? <EyeOff size={15} color="#5C5A55" /> : <Eye size={15} color="#5C5A55" />}
    </button>
  )
}
