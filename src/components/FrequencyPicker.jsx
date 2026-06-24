import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { RECUR_FREQ, RECUR_FREQ_COMMON, RECUR_FREQ_EXTRA } from '../lib/utils'

export function FrequencyPicker({ value, onChange }) {
  const [showExtra, setShowExtra] = useState(RECUR_FREQ_EXTRA.includes(value))
  const isExtra = RECUR_FREQ_EXTRA.includes(value)

  function Pill({ freq }) {
    const active = value === freq
    return (
      <button
        onClick={() => onChange(freq)}
        style={{
          flex: 1, padding: '8px 0', borderRadius: 8,
          border: active ? '1.5px solid #1E6B45' : '0.5px solid #E4E2DC',
          background: active ? '#EAF4EE' : '#F7F6F3',
          color: active ? '#1E6B45' : '#5C5A55',
          fontSize: 13, fontWeight: active ? 600 : 400,
          fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}>
        {RECUR_FREQ[freq]}
      </button>
    )
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#5C5A55', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Frecuencia</label>

      {/* Opciones comunes */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        {RECUR_FREQ_COMMON.map(f => <Pill key={f} freq={f} />)}
      </div>

      {/* Opción seleccionada del extra (si aplica) */}
      {isExtra && !showExtra && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <Pill freq={value} />
        </div>
      )}

      {/* Desplegable de más opciones */}
      {showExtra && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          {RECUR_FREQ_EXTRA.map(f => <Pill key={f} freq={f} />)}
        </div>
      )}

      <button
        onClick={() => setShowExtra(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 12, color: '#5C5A55', fontFamily: 'DM Sans, sans-serif',
          padding: '2px 0',
        }}>
        {showExtra ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {showExtra ? 'Menos opciones' : 'Más opciones'}
      </button>
    </div>
  )
}
