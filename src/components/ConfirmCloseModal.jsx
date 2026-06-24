export function ConfirmCloseModal({ open, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(2,10,31,0.5)',
      zIndex: 300, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 32px',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 16,
        width: '100%', maxWidth: 320, padding: '24px 20px',
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Descartar cambios</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Tienes información sin guardar. Si cierras la perderás.</div>
        <button onClick={onConfirm} style={{
          width: '100%', padding: 11, background: 'var(--danger)',
          color: 'var(--surface)', border: 'none', borderRadius: 'var(--radius-sm)',
          fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
          cursor: 'pointer', marginBottom: 8,
        }}>Descartar</button>
        <button onClick={onCancel} style={{
          width: '100%', padding: 11, background: 'none',
          color: 'var(--muted)', border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-sm)', fontSize: 14,
          fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
        }}>Seguir editando</button>
      </div>
    </div>
  )
}
