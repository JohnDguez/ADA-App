import { useState, useCallback, useRef } from 'react'
import styles from './Toast.module.css'

let toastFn = null

// showToast(msg) como siempre; v0.9.605: showToast(msg, [{ label, onClick }])
// agrega botones de acción (ej. "Editar", "Repetir cada mes") y lo deja 6 s.
export function Toast() {
  const [msg, setMsg] = useState('')
  const [actions, setActions] = useState([])
  const [visible, setVisible] = useState(false)
  const timer = useRef(null)

  toastFn = useCallback((text, acts) => {
    setMsg(text)
    setActions(acts || [])
    setVisible(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setVisible(false), acts && acts.length ? 6000 : 2500)
  }, [])

  return (
    <div className={`${styles.toast} ${visible ? styles.visible : ''} ${actions.length ? styles.withActions : ''}`}>
      <span>{msg}</span>
      {actions.map(a => (
        <button key={a.label} type="button" className={styles.action} onClick={() => { setVisible(false); a.onClick() }}>{a.label}</button>
      ))}
    </div>
  )
}

export function showToast(msg, actions) {
  if (toastFn) toastFn(msg, actions)
}
