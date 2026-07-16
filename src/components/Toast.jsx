import { useState, useCallback } from 'react'
import styles from './Toast.module.css'

let toastFn = null

export function Toast() {
  const [msg, setMsg] = useState('')
  const [visible, setVisible] = useState(false)

  toastFn = useCallback((text) => {
    setMsg(text)
    setVisible(true)
    setTimeout(() => setVisible(false), 2500)
  }, [])

  return (
    <div className={`${styles.toast} ${visible ? styles.visible : ''}`}>
      {msg}
    </div>
  )
}

export function showToast(msg) {
  if (toastFn) toastFn(msg)
}
