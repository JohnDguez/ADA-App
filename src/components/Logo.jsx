import { useTheme } from '../hooks/useTheme'
import { APP_NAME } from '../lib/constants'

// Componente centralizado del logo. Resuelve la variante light/dark según el tema
// activo (igual lógica que antes vivía duplicada en AuthPage/ResetPasswordPage).
// Si el logo vuelve a cambiar de nombre de archivo, solo se edita aquí.
export default function Logo({ width = '50%', maxWidth = 180, style = {} }) {
  const { theme } = useTheme()
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'sistema' && prefersDark)
  const src = isDark ? '/Luna-Pay-logo-white.svg' : '/Luna-Pay-logo.svg'

  return (
    <img
      src={src}
      alt={APP_NAME}
      style={{ width, maxWidth, display: 'block', margin: '0 auto 40px', ...style }}
    />
  )
}
