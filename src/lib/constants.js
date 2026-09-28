// Fuente única del nombre de la app en toda la UI (títulos, alt text, textos legales, etc.)
// Si vuelve a cambiar el nombre de marca, solo se edita aquí.
export const APP_NAME = 'LunaPay'

// Package name real de la app en Android/Capacitor (capacitor.config.ts →
// appId). NUEVO (v0.9.526): fuente única para armar el link de "gestionar
// suscripción" a la Play Store desde SettingsSubscriptionPage.jsx cuando la
// suscripción real del usuario es Google Play Billing — mismo valor que
// GOOGLE_PLAY_PACKAGE_NAME usa como default en api/verify-play-purchase.js
// (ese vive en el servidor, este en el cliente; duplicado a propósito, son
// 2 runtimes distintos que no comparten módulos).
export const ANDROID_PACKAGE_NAME = 'app.luna_pay.mobile'

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
