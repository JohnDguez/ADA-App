import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Check } from 'lucide-react'
import { passwordRequirements } from './PasswordSetupModal'
import mk from './Modal.module.css'

// Campo de contraseña con botón de mostrar/ocultar (v0.9.984, Modal único).
export function PasswordField({ value, onChange, label, placeholder = '••••••••', autoFocus, onEnter, bad = false }) {
  const [show, setShow] = useState(false)
  return (
    <div className={`${mk.pwd} ${bad ? mk.pwdBad : ''}`}>
      <input aria-label={label} className="field-input" type={show ? 'text' : 'password'} value={value} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)} placeholder={placeholder} onKeyDown={e => e.key === 'Enter' && onEnter?.()} />
      <button type="button" className={mk.pwdEye} onClick={() => setShow(v => !v)} aria-label={label}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

// Requisitos de una contraseña nueva en chips: gris → verde al cumplirse.
export function PasswordReqs({ password }) {
  const { t } = useTranslation()
  const r = passwordRequirements(password)
  const items = [['length', 'requirementLength'], ['uppercase', 'requirementUppercase'], ['number', 'requirementNumber'], ['symbol', 'requirementSymbol']]
  return (
    <div className={mk.reqs}>
      {items.map(([k, key]) => (
        <span key={k} className={`${mk.req} ${r[k] ? mk.reqOk : ''}`}>{r[k] ? <Check size={11} strokeWidth={3} /> : '•'} {t(`settingsAccount.editModal.${key}`)}</span>
      ))}
    </div>
  )
}
