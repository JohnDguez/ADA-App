import { ChevronLeft } from 'lucide-react'
import styles from './PageHero.module.css'

// Encabezado "hero" reutilizable para sub-páginas de Ajustes — resplandor
// azul detrás + botón de regreso e ícono representativo en la misma fila +
// título/descripción centrados debajo. Extraído de SettingsExportPage.jsx
// (agosto 2026, v0.9.442-444) para no duplicar este CSS/markup en cada
// página nueva que lo use — cualquier ajuste futuro (padding, glow, etc.)
// se hace aquí una sola vez.
//
// `icon`: componente de ícono (ej. de @phosphor-icons/react), NO un
// elemento ya renderizado — este componente le pone tamaño/peso/color.
// Pensado para íconos "duotone" de Phosphor, pero acepta cualquier
// componente de ícono con props `size`/`color` (Lucide también funciona).
export function PageHero({ icon: Icon, title, description, onBack, weight = 'duotone' }) {
  return (
    <>
      <div className={styles.glow} />

      <div className={styles.header}>
        <button onClick={onBack} className={styles.backButton}>
          <ChevronLeft size={18} color="var(--text)" />
        </button>
        <div className={styles.heroIconCircle}>
          <Icon size={26} weight={weight} color="var(--accent)" />
        </div>
        <div className={styles.headerSpacer} />
      </div>

      <div className={styles.hero}>
        <div className={styles.heroTitle}>{title}</div>
        <p className={styles.heroDesc}>{description}</p>
      </div>
    </>
  )
}
