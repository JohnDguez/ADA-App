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
    <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: `translateX(-50%) translateY(${visible ? 0 : 16}px)`, background: '#1A1915', color: '#F7F6F3', fontSize: 13, fontWeight: 500, padding: '9px 16px', borderRadius: 30, zIndex: 300, opacity: visible ? 1 : 0, transition: 'all .22s', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
      {msg}
    </div>
  )
}

export function showToast(msg) {
  if (toastFn) toastFn(msg)
}
