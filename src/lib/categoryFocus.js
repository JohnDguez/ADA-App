// Señal de un solo uso para abrir directo el historial de una categoría en
// Ajustes › Categorías (v0.9.1055). Gastos la deja puesta antes de saltar a
// Ajustes; SettingsCategoriesPage la consume al montar. Mismo patrón que
// cobroFocus.js: un módulo con una variable, sin estado global de React.
let pending = null

export function requestCategoryHistory(name) { pending = name || null }

export function consumeCategoryHistory() {
  const p = pending
  pending = null
  return p
}
