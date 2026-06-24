import { useState, useCallback } from 'react'

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
    <div style={{
      position: 'fixed', bottom: 90, left: '50%',
      transform: `translateX(-50%) translateY(${visible ? 0 : 16}px)`,
      background: 'var(--text)', color: 'var(--surface)',
      fontSize: 13, fontWeight: 500,
      padding: '9px 16px', borderRadius: 'var(--radius-full)',
      zIndex: 300, opacity: visible ? 1 : 0,
      transition: 'all .22s', pointerEvents: 'none', whiteSpace: 'nowrap',
    }}>
      {msg}
    </div>
  )
}

export function showToast(msg) {
  if (toastFn) toastFn(msg)
}
