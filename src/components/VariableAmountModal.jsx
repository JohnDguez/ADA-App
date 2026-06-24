import { useState, useEffect } from 'react'
import { ConfirmCloseModal } from './ConfirmCloseModal'

export function VariableAmountModal({ open, payment, onConfirm, onClose }) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)

  useEffect(() => { if (!open) { setAmount(''); setError('') } }, [open])

  useEffect(() => {
    if (!open) return
    const handler = () => { if (amount) setConfirmClose(true); else onClose() }
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [open, amount])

  function requestClose() { if (amount) { setConfirmClose(true); return }; onClose() }

  function handleConfirm() {
    const val = parseFloat(amount)
    if (!val || isNaN(val) || val <= 0) { setError('Ingresa el monto que pagaste'); return }
    onConfirm(val)
  }

  if (!open || !payment) return null

  return (
    <>
      <div onClick={e => e.target === e.currentTarget && requestClose()} style={{
        position: 'fixed', inset: 0, background: 'rgba(2,10,31,0.45)',
        zIndex: 250, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '0 24px',
      }}>
        <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 340, padding: '24px 20px' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Registrar pago</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>{payment.name} — ingresa el monto que pagaste</div>
          {error && <div style={{ background: 'var(--danger-soft)', border: '0.5px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
          <label className="field-label">Monto pagado</label>
          <input autoFocus type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" onKeyDown={e => e.key === 'Enter' && handleConfirm()} className="field-input" style={{ marginBottom: 14 }} />
          <button onClick={handleConfirm} className="btn-primary" style={{ marginBottom: 8 }}>Confirmar pago</button>
          <button onClick={requestClose} className="btn-ghost">Cancelar</button>
        </div>
      </div>
      <ConfirmCloseModal open={confirmClose} onConfirm={() => { setConfirmClose(false); onClose() }} onCancel={() => setConfirmClose(false)} />
    </>
  )
}
