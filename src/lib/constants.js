// Fuente única del nombre de la app en toda la UI (títulos, alt text, textos legales, etc.)
// Si vuelve a cambiar el nombre de marca, solo se edita aquí.
export const APP_NAME = 'LunaPay'

// Fuente única del orden/contenido de los tabs de navegación principal —
// antes vivía duplicado como LEFT_TABS/RIGHT_TABS dentro de BottomNav.jsx.
// NUEVO (adaptación tablet/desktop, Regla 43): NavRail.jsx reutiliza este
// mismo arreglo, para que el orden nunca pueda desincronizarse entre el
// nav de mobile y el riel de tablet/desktop. Los íconos se importan aquí
// como referencias a componentes (no JSX), válido en un archivo .js.
import { Home, Wallet, CalendarClock, Goal } from 'lucide-react'

export const NAV_ITEMS = [
  { id: 'home',       Icon: Home,          labelKey: 'bottomNav.home' },
  { id: 'payments',   Icon: Wallet,        labelKey: 'bottomNav.payments' },
  { id: 'recurrents', Icon: CalendarClock, labelKey: 'bottomNav.recurrents' },
  { id: 'goals',      Icon: Goal,          labelKey: 'bottomNav.goals' },
]
