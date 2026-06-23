import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Mail, Lock, User } from 'lucide-react'

export function AuthPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit() {
    setError(''); setSuccess(''); setLoading(true)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError('Correo o contraseña incorrectos')
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } })
      if (error) setError(error.message)
      else setSuccess('Cuenta creada. Revisa tu correo para confirmar.')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 24px 40px', background: '#F7F6F3' }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ width: 44, height: 44, background: '#1E6B45', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <DollarSignIcon />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 600, color: '#1A1915', marginBottom: 4 }}>Ada</h1>
        <p style={{ fontSize: 14, color: '#5C5A55' }}>Controla tus pagos, sin sorpresas.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['login','register'].map(m => (
          <button key={m} onClick={() => { setMode(m); setError('') }} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: mode === m ? '1.5px solid #1E6B45' : '0.5px solid #E4E2DC', background: mode === m ? '#EAF4EE' : '#fff', color: mode === m ? '#1E6B45' : '#5C5A55', fontWeight: 500, fontSize: 14 }}>
            {m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        ))}
      </div>

      {error && <div style={{ background: '#FCDEDE', border: '0.5px solid #F5BABA', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#B83232', marginBottom: 14 }}>{error}</div>}
      {success && <div style={{ background: '#EAF4EE', border: '0.5px solid #C5E0CF', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#1E6B45', marginBottom: 14 }}>{success}</div>}

      {mode === 'register' && (
        <AuthField icon={<User size={16} color="#5C5A55" />} label="Nombre">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" />
        </AuthField>
      )}

      <AuthField icon={<Mail size={16} color="#5C5A55" />} label="Correo">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
      </AuthField>

      <AuthField icon={<Lock size={16} color="#5C5A55" />} label="Contraseña">
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
      </AuthField>

      <button onClick={handleSubmit} disabled={loading} style={{ width: '100%', padding: 13, background: '#1E6B45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, marginTop: 8, opacity: loading ? 0.7 : 1 }}>
        {loading ? 'Cargando…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
      </button>
    </div>
  )
}

function AuthField({ label, icon, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#5C5A55', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>{icon}</div>
        <div style={{ paddingLeft: 36 }}>{children}</div>
      </div>
    </div>
  )
}

function DollarSignIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
}
