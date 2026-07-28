import { Home, Wallet, CalendarClock, User, Plus, ChevronUp, GripHorizontal } from 'lucide-react'
import styles from './BottomNav.module.css'

const LEFT_TABS = [
  { id: 'home',     Icon: Home },
  { id: 'payments', Icon: Wallet },
]
const RIGHT_TABS = [
  { id: 'recurrents', Icon: CalendarClock },
  { id: 'settings',   Icon: User },
]

// `showGoalsTray`/`onOpenGoals` — franja de "Mis metas" (Fase 2 de Metas de
// ahorro, ver CONTEXT.md), solo se pasa como true desde App.jsx cuando
// tab === 'home'. Aditivo a propósito: sin estas props, el nav se ve y se
// comporta EXACTAMENTE igual que antes en el resto de las pestañas — nunca
// se tocó el diseño existente, solo se le agregó una fila opcional arriba.
// El "+" se reposiciona un poco más arriba (`.addButtonRaised`) SOLO cuando
// la franja está presente, para que asome hasta la mitad de sí mismo por
// encima de la franja nueva (diseño aprobado por Johnatan tras iterar en
// mockup) — en el resto de las pestañas conserva su posición de siempre.
export function BottomNav({ active, onChange, onAdd, showGoalsTray = false, onOpenGoals }) {
  return (
    <nav className={`${styles.nav} ${showGoalsTray ? styles.navWithTray : ''}`}>
      {showGoalsTray && (
        <div
          className={styles.goalsRow}
          onClick={onOpenGoals}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onOpenGoals()}
        >
          <div className={styles.goalsLabel}>
            <ChevronUp size={13} color="rgba(255,255,255,0.65)" />
            <span>Mis metas</span>
          </div>
          <GripHorizontal size={15} color="rgba(255,255,255,0.5)" />
        </div>
      )}

      <div className={styles.iconRow}>
        {LEFT_TABS.map(({ id, Icon }) => (
          <TabBtn key={id} id={id} Icon={Icon} active={active === id} onChange={onChange} />
        ))}

        <div className={styles.addButtonWrapper}>
          <button
            onClick={onAdd}
            className={`${styles.addButton} ${showGoalsTray ? styles.addButtonRaised : ''}`}
          >
            <Plus size={26} color="var(--nav-icon)" strokeWidth={2.5} />
          </button>
        </div>

        {RIGHT_TABS.map(({ id, Icon }) => (
          <TabBtn key={id} id={id} Icon={Icon} active={active === id} onChange={onChange} />
        ))}
      </div>
    </nav>
  )
}

function TabBtn({ id, Icon, active, onChange }) {
  return (
    <button
      onClick={() => onChange(id)}
      className={styles.tabButton}
      style={{
        background: active
          ? 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)'
          : 'none',
      }}
    >
      <Icon size={22} strokeWidth={active ? 2.2 : 1.8} color={active ? 'var(--nav-icon)' : 'rgba(255,255,255,0.5)'} />
    </button>
  )
}
