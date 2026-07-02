import { useState, useEffect } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('ada_theme') || 'sistema')

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'sistema') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
    localStorage.setItem('ada_theme', theme)
  }, [theme])

  return { theme, setTheme }
}
