import { ChevronRight } from 'lucide-react'
import styles from './SettingsShared.module.css'

// Componentes reutilizados por SettingsPage.jsx y sus sub-páginas
// (SettingsAccountPage, SettingsCobroPage, SettingsCategoriesPage,
// SettingsNotificationsPage, SettingsAppearancePage). Antes vivían duplicados
// al final de SettingsPage.jsx.

export function Card({ children }) {
  return <div className={styles.card}>{children}</div>
}

export function SectionLabel({ children }) {
  return <div className={styles.sectionLabel}>{children}</div>
}

// `filled` (opcional, NUEVO): fondo sólido var(--premium-gold) de borde a
// borde + texto/ícono/chevron SIEMPRE en var(--premium-gold-text) — ambas
// variables ya son fijas sin importar el tema (ver index.css, bloque
// --premium-*), así que el contraste queda garantizado en claro y oscuro sin
// tocar nada más. Cuando `filled` es true, ignora `iconColor` por completo
// (dejaría de tener sentido combinarlos). Usado solo por el renglón
// "Mi suscripción"/"Obtener Premium" de SettingsPage.jsx — nunca junto con
// `iconColor` en el mismo renglón.
export function Row({ label, sub, value, onClick, last, icon: Icon, iconColor, filled }) {
  const color = filled ? 'var(--premium-gold-text)' : (iconColor || 'var(--text)')
  return (
    <div
      onClick={onClick}
      className={`${styles.row} ${last ? styles.rowLast : ''} ${onClick ? styles.rowClickable : ''} ${filled ? styles.rowFilled : ''}`}
    >
      <div className={styles.rowLeft}>
        {Icon && <Icon size={16} color={color} />}
        <div>
          <span className={styles.rowLabel} style={filled || iconColor ? { color } : undefined}>{label}</span>
          {sub && <div className={styles.rowSub} style={filled || iconColor ? { color } : undefined}>{sub}</div>}
        </div>
      </div>
      <div className={styles.rowRight}>
        {value && <span className={styles.rowValue} style={filled ? { color } : undefined}>{value}</span>}
        {onClick && <ChevronRight size={14} color={color} />}
      </div>
    </div>
  )
}

export function Toggle({ on }) {
  return (
    <div className="toggle-track" style={{ background: on ? 'var(--accent)' : 'var(--border)' }}>
      <div className="toggle-thumb" style={{ left: on ? 19 : 3 }} />
    </div>
  )
}

export function NotifToggle({ label, sub, value, onChange, last }) {
  return (
    <div
      onClick={() => onChange(!value)}
      className={`${styles.notifRow} ${last ? styles.notifRowLast : ''}`}
    >
      <div>
        <div className={styles.notifLabel}>{label}</div>
        <div className={styles.notifSub}>{sub}</div>
      </div>
      <Toggle on={value} />
    </div>
  )
}
