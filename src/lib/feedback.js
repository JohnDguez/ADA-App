// Feedback alpha — popup del día 8 (App.jsx) y botón en Perfil (SettingsPage.jsx).
// El formulario vive en Jotform; tiene un campo oculto `email` que se precarga
// vía parámetro de URL, así cada respuesta queda ligada a la cuenta sin que el
// usuario tenga que escribir nada.
export const FEEDBACK_FORM_URL = 'https://form.jotform.com/262017759669067'

export function buildFeedbackUrl(email) {
  return email ? `${FEEDBACK_FORM_URL}?email=${encodeURIComponent(email)}` : FEEDBACK_FORM_URL
}

// Días desde que se creó la cuenta (user.created_at) hasta mostrar el primer
// popup de feedback.
export const FEEDBACK_PROMPT_AFTER_DAYS = 8

// Días a esperar antes de volver a mostrar el popup tras "Recordarme en 3 días".
export const FEEDBACK_REMIND_AFTER_DAYS = 3
