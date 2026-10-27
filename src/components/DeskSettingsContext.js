import { createContext, useContext } from 'react'

// Verdadero cuando una sub-página de Ajustes se muestra dentro del panel
// derecho de escritorio (v0.9.834): PageHero y Card cambian de forma sin
// que cada página tenga que saberlo.
export const DeskSettingsContext = createContext(false)
export const useDeskSettings = () => useContext(DeskSettingsContext)
