import { useState, useEffect } from 'react'
import { ConfirmCloseModal } from './ConfirmCloseModal'

export function VariableAmountModal({ open, payment, onConfirm, onClose }) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)

  useEffect(() => {
    if (!open) { setAmount(''); setError('') }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = () => {
      if (amount) { setConfirmClose(true) } else { onClose() }
    }
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [open, amount])

  function requestClose() {
    if (amount) { setConfirmClose(true); return }
    onClose()
  }

  function handleConfirm() {
    const val = parseFloat(amount)
    if (!val || isNaN(val) || val <= 0) { setError('Ingresa el monto que pagaste'); return }
    onConfirm(val)
  }

  if (!open || !payment) return null

  return (
    <>
      <div onClick={e => e.target === e.currentTarget && requestClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(26,25,21,0.45)', zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 340, padding: '24px 20px' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1A1915', marginBottom: 4 }}>Registrar pago</div>
          <div style={{ fontSize: 13, color: '#5C5A55', marginBottom: 16 }}>{payment.name} — ingresa el monto que pagaste</div>
          {error && <div style={{ background: '#FCDEDE', border: '0.5px solid #F5BABA', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#B83232', marginBottom: 12 }}>{error}</div>}
          <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#5C5A55', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Monto pagado</label>
          <input
            autoFocus
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            onKeyDown={e => e.key === 'Enter' && handleConfirm()}
            style={{ width: '100%', padding: '11px 12px', border: '0.5px solid #E4E2DC', borderRadius: 8, fontFamily: 'DM Sans, sans-serif', fontSize: 15, background: '#F7F6F3', color: '#1A1915', outline: 'none', marginBottom: 14 }}
          />
          <button onClick={handleConfirm} style={{ width: '100%', padding: 12, background: '#1E6B45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', marginBottom: 8 }}>
            Confirmar pago
          </button>
          <button onClick={requestClose} style={{ width: '100%', padding: 10, background: 'none', color: '#5C5A55', border: '0.5px solid #E4E2DC', borderRadius: 8, fontSize: 14, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
      <ConfirmCloseModal
        open={confirmClose}
        onConfirm={() => { setConfirmClose(false); onClose() }}
        onCancel={() => setConfirmClose(false)}
      />
    </>
  )
}
