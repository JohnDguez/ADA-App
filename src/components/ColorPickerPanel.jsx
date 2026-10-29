import { useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { hexToHsl, hslToHex, isHexColor } from '../lib/colorUtils'
import styles from './ColorPickerPanel.module.css'

// Selector de color propio (v0.9.921): barra de tono, barra de brillo y campo
// con el código. Controlado por `value` (cualquier color; el resultado siempre
// sale como "#RRGGBB"). Misma apariencia en PWA, iPhone y Android.

function Bar({ value, onChange, background, knob, label }) {
  const ref = useRef(null)
  function setFrom(e) {
    const r = ref.current.getBoundingClientRect()
    onChange(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)))
  }
  return (
    <div
      ref={ref}
      className={styles.bar}
      style={{ background }}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setFrom(e) }}
      onPointerMove={e => { if (e.buttons) setFrom(e) }}
      onKeyDown={e => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(0, value - 0.02)) }
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(1, value + 0.02)) }
      }}
    >
      <span className={styles.knob} style={{ left: `calc((100% - 1.75rem) * ${value})`, background: knob }} />
    </div>
  )
}

export function ColorPickerPanel({ value, onChange }) {
  const { t } = useTranslation()
  const [hsl, setHsl] = useState(() => hexToHsl(value))
  const [hexText, setHexText] = useState(() => (isHexColor(value) ? value.toUpperCase() : ''))

  // Si el color cambia desde fuera (ej. el usuario toca un círculo de la paleta)
  // el selector se reacomoda a ese color.
  useEffect(() => {
    if (isHexColor(value) && value.toUpperCase() !== hslToHex(hsl.h, hsl.s, hsl.l)) {
      setHsl(hexToHsl(value)); setHexText(value.toUpperCase())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function apply(next) {
    setHsl(next)
    const hex = hslToHex(next.h, next.s, next.l)
    setHexText(hex)
    onChange(hex)
  }
  const s = Math.max(hsl.s, 0.35) // evita barras sin color si el hex es casi gris
  const hueCss = 'linear-gradient(90deg, hsl(0 85% 55%), hsl(60 85% 55%), hsl(120 85% 55%), hsl(180 85% 55%), hsl(240 85% 55%), hsl(300 85% 55%), hsl(360 85% 55%))'
  const lightCss = `linear-gradient(90deg, hsl(${hsl.h} ${s * 100}% 0%), hsl(${hsl.h} ${s * 100}% 50%), hsl(${hsl.h} ${s * 100}% 100%))`
  const current = hslToHex(hsl.h, hsl.s, hsl.l)

  return (
    <div className={styles.panel}>
      <Bar value={hsl.h / 360} onChange={v => apply({ ...hsl, s, h: v * 360 })} background={hueCss} knob={current} label={t('settingsCategories.mobile.hueLabel')} />
      <Bar value={hsl.l} onChange={v => apply({ ...hsl, s, l: v })} background={lightCss} knob={current} label={t('settingsCategories.mobile.brightnessLabel')} />
      <div className={styles.hexRow}>
        <span className={styles.swatch} style={{ background: current }} />
        <input
          className={styles.hex}
          value={hexText}
          maxLength={7}
          spellCheck={false}
          autoCapitalize="characters"
          aria-label={t('settingsCategories.mobile.hexLabel')}
          placeholder="#A1B2C3"
          onChange={e => {
            let v = e.target.value.toUpperCase()
            if (v && v[0] !== '#') v = '#' + v
            setHexText(v)
            if (isHexColor(v)) { setHsl(hexToHsl(v)); onChange(v) }
          }}
        />
      </div>
      <div className={styles.note}>{t('settingsCategories.mobile.inkNote')}</div>
    </div>
  )
}
