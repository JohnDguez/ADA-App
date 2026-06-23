export function ConfirmCloseModal({ open, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,25,21,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 32px' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 320, padding: '24px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1915', marginBottom: 6 }}>Descartar cambios</div>
        <div style={{ fontSize: 13, color: '#5C5A55', marginBottom: 20 }}>Tienes información sin guardar. Si cierras la perderás.</div>
        <button onClick={onConfirm} style={{ width: '100%', padding: 11, background: '#B83232', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', marginBottom: 8 }}>
          Descartar
        </button>
        <button onClick={onCancel} style={{ width: '100%', padding: 11, background: 'none', color: '#5C5A55', border: '0.5px solid #E4E2DC', borderRadius: 8, fontSize: 14, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
          Seguir editando
        </button>
      </div>
    </div>
  )
}
