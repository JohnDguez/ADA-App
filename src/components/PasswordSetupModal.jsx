import { useState, useEffect } from 'react'
import { Lock, Eye, EyeOff, Check, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Validador de fortaleza de contraseña ─────────────────────────────────────
export function passwordRequirements(pwd) {
  return {
    length:    pwd.length >= 8,
    uppercase: /[A-Z]/.test(pwd),
    number:    /[0-9]/.test(pwd),
    symbol:    /[^A-Za-z0-9]/.test(pwd),
  }
}

export function isPasswordStrong(pwd) {
  const r = passwordRequirements(pwd)
  return r.length && r.uppercase && r.number && r.symbol
}

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

// ── Modal de configuración de contraseña (Google users) ──────────────────────
export function PasswordSetupModal({ userId, onDone }) {
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConf, setShowConf] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const reqs   = passwordRequirements(password)
  const strong = isPasswordStrong(password)
  const match  = password && confirm && password === confirm

  useEffect(() => {
    document.body.classList.add('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [])

  async function handleSave() {
    setError('')
    if (!strong) { setError('La contraseña no cumple todos los requisitos'); return }
    if (!match)  { setError('Las contraseñas no coinciden'); return }

    setLoading(true)
    const { error: updErr } = await supabase.auth.updateUser({ password })
    if (updErr) { setError(updErr.message); setLoading(false); return }

    await supabase.from('profiles').update({ has_password: true }).eq('id', userId)
    setLoading(false)
    onDone()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(2,10,31,0.6)',
      zIndex: 500,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: '20px 20px 0 0',
        width: '100%', maxWidth: 420,
        padding: '24px 20px 36px',
        animation: 'modalSlideUp .32s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
      }}>
        {/* Encabezado */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
            Crea una contraseña
          </div>
          <div style={{ fontSize: 13, fontWeight: 400, color: 'var(--text)', lineHeight: 1.6 }}>
            Para mantener tu cuenta segura necesitas una contraseña. La usarás para confirmar acciones importantes como eliminar datos.
          </div>
        </div>

        {error && (
          <div style={{ background: 'var(--danger-soft)', border: '0.5px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 13, color: 'var(--danger)', marginBottom: 14 }}>
            {error}
          </div>
        )}

        {/* Campo contraseña */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Contraseña
          </label>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
              <Lock size={15} color="var(--text)" />
            </div>
            <input
              autoFocus
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="field-input"
              style={{ paddingLeft: 40, paddingRight: 40 }}
            />
            <button type="button" onClick={() => setShowPass(v => !v)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
              {showPass ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
            </button>
          </div>
        </div>

        {/* Requisitos */}
        {password.length > 0 && (
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 12 }}>
            <RequirementRow met={reqs.length}    label="Mínimo 8 caracteres" />
            <RequirementRow met={reqs.uppercase} label="Al menos una mayúscula" />
            <RequirementRow met={reqs.number}    label="Al menos un número" />
            <RequirementRow met={reqs.symbol}    label="Al menos un símbolo especial (!@#$...)" />
          </div>
        )}

        {/* Campo confirmar */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Confirmar contraseña
          </label>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
              <Lock size={15} color="var(--text)" />
            </div>
            <input
              type={showConf ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repite tu contraseña"
              className="field-input"
              style={{
                paddingLeft: 40, paddingRight: 40,
                borderColor: confirm && !match ? 'var(--danger)' : undefined,
              }}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <button type="button" onClick={() => setShowConf(v => !v)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
              {showConf ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
            </button>
          </div>
          {confirm && !match && (
            <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Las contraseñas no coinciden</div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={loading || !strong || !match}
          className="btn-primary"
          style={{ opacity: loading || !strong || !match ? 0.6 : 1 }}
        >
          {loading ? 'Guardando…' : 'Crear contraseña'}
        </button>
      </div>
    </div>
  )
}
