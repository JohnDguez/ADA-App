import { useState, useEffect, useRef } from 'react'
import { ConfirmCloseModal } from './ConfirmCloseModal'

export function VariableAmountModal({ open, payment, mode = 'pay', spacePermissions, onConfirm, onClose }) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const amountRef = useRef(amount)

  // "Registrar pago" (mode='pay', se usa al marcar pagado) cae bajo el
  // mismo permiso que marcar pagado — "Monto a pagar" (mode='estimate',
  // capturar el monto SIN marcar pagado) cae bajo editar, tal como se
  // decidió y ya se aplicó en el trigger de la base de datos (v0.9.132).
  const allowed = !spacePermissions || (mode === 'estimate' ? spacePermissions.can_edit : spacePermissions.can_mark_paid)

  useEffect(() => { amountRef.current = amount }, [amount])
  useEffect(() => {
    if (!open) { setAmount(''); setError('') }
    // Si el pago ya trae un monto capturado previamente (estimado, o un
    // intento anterior), se precarga en vez de arrancar vacío — así el
    // usuario no tiene que volver a escribirlo si solo va a confirmarlo.
    else if (payment?.amount) setAmount(String(payment.amount))
  }, [open, payment])

  useEffect(() => {
    if (open) document.body.classList.add('modal-open')
    else document.body.classList.remove('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = () => {
      if (amountRef.current) setConfirmClose(true)
      else onClose()
    }
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [open])

  function requestClose() { if (amount) { setConfirmClose(true); return }; onClose() }

  function handleConfirm() {
    const val = parseFloat(amount)
    if (!val || isNaN(val) || val <= 0) { setError(mode === 'estimate' ? 'Ingresa el monto a pagar' : 'Ingresa el monto que pagaste'); return }
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
        <div style={{
          background: 'var(--surface)', borderRadius: 16,
          width: '100%', maxWidth: 340, padding: '24px 20px',
          animation: 'modalPopIn .22s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            {mode === 'estimate' ? 'Monto a pagar' : 'Registrar pago'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 16 }}>
            {payment.name} — {mode === 'estimate' ? 'ingresa el monto que vas a pagar' : 'ingresa el monto que pagaste'}
          </div>
          {!allowed && (
            <div style={{ background: 'var(--warning-soft)', border: '0.5px solid var(--warning-border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 13, color: 'var(--warning)', marginBottom: 12 }}>
              No tienes permitido {mode === 'estimate' ? 'editar' : 'marcar'} pagos en este Espacio Compartido.
            </div>
          )}
          {error && <div style={{ background: 'var(--danger-soft)', border: '0.5px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
          <div style={{ opacity: allowed ? 1 : 0.5, pointerEvents: allowed ? 'auto' : 'none' }}>
            <label className="field-label">{mode === 'estimate' ? 'Monto' : 'Monto pagado'}</label>
            <input autoFocus type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" onKeyDown={e => e.key === 'Enter' && handleConfirm()} className="field-input" style={{ marginBottom: 14 }} />
            <button onClick={handleConfirm} disabled={!allowed} className="btn-primary" style={{ marginBottom: 8, opacity: allowed ? 1 : 0.6 }}>{mode === 'estimate' ? 'Guardar monto' : 'Confirmar pago'}</button>
          </div>
          <button onClick={requestClose} className="btn-ghost">Cancelar</button>
        </div>
      </div>
      <ConfirmCloseModal open={confirmClose} onConfirm={() => { setConfirmClose(false); onClose() }} onCancel={() => setConfirmClose(false)} />
    </>
  )
}
