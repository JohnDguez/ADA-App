import { useState, useEffect } from 'react'
import { Lock, Eye, EyeOff, Check, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import styles from './PasswordSetupModal.module.css'

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
    <div className={styles.reqRow}>
      <div className={`${styles.reqCircle} ${met ? styles.reqCircleMet : ''}`}>
        {met
          ? <Check size={10} color="var(--surface)" strokeWidth={3} />
          : <X size={10} color="var(--text)" strokeWidth={2.5} />
        }
      </div>
      <span className={styles.reqLabel}>{label}</span>
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
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Encabezado */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            Crea una contraseña
          </div>
          <div className={styles.headerDescription}>
            Para mantener tu cuenta segura necesitas una contraseña. La usarás para confirmar acciones importantes como eliminar datos.
          </div>
        </div>

        {error && (
          <div className={styles.errorBox}>
            {error}
          </div>
        )}

        {/* Campo contraseña */}
        <div className={styles.passwordField}>
          <label className={styles.fieldLabel}>
            Contraseña
          </label>
          <div className={styles.inputWrapper}>
            <div className={styles.inputIconLeft}>
              <Lock size={15} color="var(--text)" />
            </div>
            <input
              autoFocus
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`field-input ${styles.input}`}
            />
            <button type="button" onClick={() => setShowPass(v => !v)} className={styles.toggleVisibilityButton}>
              {showPass ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
            </button>
          </div>
        </div>

        {/* Requisitos */}
        {password.length > 0 && (
          <div className={styles.requirementsBox}>
            <RequirementRow met={reqs.length}    label="Mínimo 8 caracteres" />
            <RequirementRow met={reqs.uppercase} label="Al menos una mayúscula" />
            <RequirementRow met={reqs.number}    label="Al menos un número" />
            <RequirementRow met={reqs.symbol}    label="Al menos un símbolo especial (!@#$...)" />
          </div>
        )}

        {/* Campo confirmar */}
        <div className={styles.confirmField}>
          <label className={styles.fieldLabel}>
            Confirmar contraseña
          </label>
          <div className={styles.inputWrapper}>
            <div className={styles.inputIconLeft}>
              <Lock size={15} color="var(--text)" />
            </div>
            <input
              type={showConf ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repite tu contraseña"
              className={`field-input ${styles.input} ${confirm && !match ? styles.inputError : ''}`}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <button type="button" onClick={() => setShowConf(v => !v)} className={styles.toggleVisibilityButton}>
              {showConf ? <EyeOff size={16} color="var(--text)" /> : <Eye size={16} color="var(--text)" />}
            </button>
          </div>
          {confirm && !match && (
            <div className={styles.matchError}>Las contraseñas no coinciden</div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={loading || !strong || !match}
          className="btn-primary"
        >
          {loading ? 'Guardando…' : 'Crear contraseña'}
        </button>
      </div>
    </div>
  )
}
