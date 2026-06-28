import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { RECUR_FREQ, RECUR_FREQ_COMMON, RECUR_FREQ_EXTRA } from '../lib/utils'

export function FrequencyPicker({ value, onChange }) {
  const [showExtra, setShowExtra] = useState(RECUR_FREQ_EXTRA.includes(value))

  function Pill({ freq }) {
    const active = value === freq
    return (
      <button onClick={() => onChange(freq)} style={{
        flex: 1, padding: '8px 0', borderRadius: 5,
        border: 'none',
        background: active ? 'var(--accent)' : 'var(--bg)',
        color: active ? '#fff' : 'var(--text)',
        fontSize: 13, fontWeight: active ? 600 : 400,
        fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', whiteSpace: 'nowrap',
      }}>
        {RECUR_FREQ[freq]}
      </button>
    )
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <label className="field-label" style={{ marginBottom: 6, display: 'block' }}>Frecuencia</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        {RECUR_FREQ_COMMON.map(f => <Pill key={f} freq={f} />)}
      </div>
      {showExtra && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          {RECUR_FREQ_EXTRA.map(f => <Pill key={f} freq={f} />)}
        </div>
      )}
      <button onClick={() => setShowExtra(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: 4,
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 12, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', padding: '2px 0',
      }}>
        {showExtra ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {showExtra ? 'Menos opciones' : 'Más opciones'}
      </button>
    </div>
  )
}
