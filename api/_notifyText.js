// Textos bilingües (es/en) para TODO el contenido de notificaciones que se
// genera en el servidor — push y las filas de la tabla `notifications` que
// lee NotificationsPanel.jsx. Hasta v0.9.512 esto vivía como texto en
// español fijo, directo en cada endpoint (send-notifications.js,
// notify-space-change.js, manage-shared-fund.js, register-contribution.js)
// — la limitación estaba documentada desde v0.9.335 ("traducir el CONTENIDO
// real de las notificaciones... requeriría un proyecto de i18n del lado del
// servidor aparte") pero nunca se había construido. Centralizado aquí para
// que los 4 archivos no dupliquen cada frase en 2 idiomas por su cuenta.
//
// Prefijo `_` a propósito (mismo criterio que `_notifyLib.js`): Vercel no
// expone como ruta los archivos de /api que empiezan con guión bajo.

// `profiles.language` guarda 'system' | 'es' | 'en' (o puede venir null si
// la columna es nueva para esa fila) — el servidor no tiene forma de saber
// qué es "system" para una persona (eso solo lo sabe su navegador), así que
// aquí 'system'/null cae a 'es', igual que `fallbackLng: 'es'` en
// src/i18n/index.js del lado del cliente.
function resolveLang(preference) {
  return preference === 'en' ? 'en' : 'es'
}

// ── Recordatorios personales (send-notifications.js) ────────────────────
function overdueText(lang, count, names) {
  if (lang === 'en') {
    const n = count > 1 ? 's' : ''
    return { title: `${count} overdue payment${n}`, body: names }
  }
  const n = count > 1 ? 's' : ''
  return { title: `${count} pago${n} vencido${n}`, body: names }
}

function dueTodayText(lang, name) {
  if (lang === 'en') return { title: `${name} is due today`, body: "Don't forget to pay it and record it" }
  return { title: `${name} vence hoy`, body: 'No olvides hacer el pago y registrarlo' }
}

function upcomingText(lang, count, names) {
  if (lang === 'en') {
    const n = count > 1 ? 's' : ''
    const verb = count > 1 ? 'are' : 'is'
    return { title: `${count} upcoming payment${n}`, body: `${names} — ${verb} due soon` }
  }
  const n = count > 1 ? 's' : ''
  return { title: `${count} pago${n} próximo${n}`, body: `${names} — vence${count > 1 ? 'n' : ''} pronto` }
}

function cobroDayText(lang, count) {
  if (lang === 'en') {
    const n = count > 1 ? 's' : ''
    return { title: 'Today is your pay day', body: `You have ${count} pending payment${n} to cover` }
  }
  const n = count > 1 ? 's' : ''
  return { title: 'Hoy es tu día de cobro', body: `Tienes ${count} pago${n} pendiente${n} por cubrir` }
}

function goalDeadlineText(lang, name, days, remainingMoney) {
  if (lang === 'en') {
    const cuando = days === 0 ? 'Your goal is due today' : `${days} day${days > 1 ? 's' : ''} left`
    return { title: `${cuando}: ${name}`, body: `You still need ${remainingMoney} to complete it` }
  }
  const cuando = days === 0 ? 'Hoy vence tu meta' : `Te quedan ${days} día${days > 1 ? 's' : ''}`
  return { title: `${cuando}: ${name}`, body: `Todavía te falta ${remainingMoney} para completarla` }
}

function trialEndingText(lang) {
  if (lang === 'en') {
    return {
      title: 'Your Premium trial ends in 2 days',
      body: 'After that, your plan will be charged normally. You can cancel anytime from Settings.',
    }
  }
  return {
    title: 'Tu prueba de Premium termina en 2 días',
    body: 'Después de eso se activará el cobro normal de tu plan. Puedes cancelar cuando quieras desde Ajustes.',
  }
}

// ── Espacio Compartido — pagos (notify-space-change.js) ─────────────────
const FREQ_LABEL = {
  es: { weekly: 'semanal', biweekly: 'quincenal', monthly: 'mensual' },
  en: { weekly: 'weekly', biweekly: 'biweekly', monthly: 'monthly' },
}

function paymentTitleText(lang, actorName, action, paymentType) {
  if (lang === 'en') {
    if (action === 'added') {
      if (paymentType === 'recurrente')    return `${actorName} added a recurring payment`
      if (paymentType === 'parcialidades') return `${actorName} added an installment payment`
      return `${actorName} added a one-time payment`
    }
    if (action === 'marked_paid') return `${actorName} marked a payment as paid`
    if (action === 'deleted')     return `${actorName} deleted a payment`
    return `${actorName} made a change`
  }
  if (action === 'added') {
    if (paymentType === 'recurrente')    return `${actorName} agregó un pago recurrente`
    if (paymentType === 'parcialidades') return `${actorName} agregó un pago en parcialidades`
    return `${actorName} agregó un pago único`
  }
  if (action === 'marked_paid') return `${actorName} marcó un pago como pagado`
  if (action === 'deleted')     return `${actorName} eliminó un pago`
  return `${actorName} hizo un cambio`
}

function paymentBodyText(lang, { action, paymentName, amount, paymentType, recurFreq, totalInstallments, isVariable, fmt }) {
  if (lang === 'en') {
    if (action === 'added') {
      const amountStr = (isVariable && !(Number(amount) > 0)) ? 'Variable amount' : fmt(amount)
      if (paymentType === 'recurrente') {
        const freq = FREQ_LABEL.en[recurFreq] || 'monthly'
        return `${paymentName} — ${amountStr} ${freq}`
      }
      if (paymentType === 'parcialidades') {
        return `${paymentName} — ${totalInstallments || ''} payments of ${amountStr}`
      }
      return `${paymentName} — ${amountStr}`
    }
    if (action === 'marked_paid') return `${paymentName} was paid`
    if (action === 'deleted')     return `${paymentName} was removed from the space`
    return paymentName
  }
  if (action === 'added') {
    const amountStr = (isVariable && !(Number(amount) > 0)) ? 'Monto variable' : fmt(amount)
    if (paymentType === 'recurrente') {
      const freq = FREQ_LABEL.es[recurFreq] || 'mensual'
      return `${paymentName} — ${amountStr} ${freq}`
    }
    if (paymentType === 'parcialidades') {
      return `${paymentName} — ${totalInstallments || ''} pagos de ${amountStr}`
    }
    return `${paymentName} — ${amountStr}`
  }
  if (action === 'marked_paid') return `${paymentName} ya fue pagado`
  if (action === 'deleted')     return `${paymentName} se eliminó del espacio`
  return paymentName
}

// ── Espacio Compartido — miembros/espacio/Fondo ──────────────────────────
function joinedText(lang, actorName, spaceName) {
  if (lang === 'en') return { title: `${actorName} joined the space`, body: `Now part of ${spaceName}` }
  return { title: `${actorName} se unió al espacio`, body: `Ahora es parte de ${spaceName}` }
}

function leftText(lang, actorName, spaceName) {
  if (lang === 'en') return { title: `${actorName} left the space`, body: `No longer part of ${spaceName}` }
  return { title: `${actorName} salió del espacio`, body: `Ya no forma parte de ${spaceName}` }
}

function removedBroadcastText(lang, actorName, removedUserName, spaceName) {
  if (lang === 'en') {
    return { title: `${actorName} removed ${removedUserName || 'a member'} from the space`, body: spaceName }
  }
  return { title: `${actorName} eliminó a ${removedUserName || 'un miembro'} del espacio`, body: spaceName }
}

function removedTargetText(lang, actorName, spaceName) {
  if (lang === 'en') return { title: `You were removed from ${spaceName}`, body: `${actorName} removed you from the space` }
  return { title: `Fuiste eliminado de ${spaceName}`, body: `${actorName} te quitó del espacio` }
}

function permissionsChangedText(lang, actorName, spaceName) {
  if (lang === 'en') {
    return { title: `Your permissions in ${spaceName} changed`, body: `${actorName} updated what you can do in the space` }
  }
  return { title: `Tus permisos en ${spaceName} cambiaron`, body: `${actorName} actualizó lo que puedes hacer en el espacio` }
}

function spaceConfigChangedText(lang, actorName, spaceName) {
  if (lang === 'en') {
    return { title: `${actorName} updated ${spaceName}'s settings`, body: 'Check the pay period or the space income' }
  }
  return { title: `${actorName} actualizó la configuración de ${spaceName}`, body: 'Revisa el periodo de cobro o el ingreso del espacio' }
}

function spaceDeletedText(lang, actorName, spaceName) {
  if (lang === 'en') return { title: `${spaceName} was deleted`, body: `${actorName} deleted this Shared Space` }
  return { title: `${spaceName} fue eliminado`, body: `${actorName} eliminó este Espacio Compartido` }
}

function spaceDataClearedText(lang, actorName, spaceName) {
  if (lang === 'en') {
    return { title: `${actorName} reset ${spaceName}'s data`, body: "All the space's payment and income history was deleted" }
  }
  return { title: `${actorName} reinició los datos de ${spaceName}`, body: 'Se borró todo el historial de pagos e ingresos del espacio' }
}

// ── Fondo Compartido (manage-shared-fund.js) ─────────────────────────────
function fundContributionText(lang, actorName, amountStr, spaceName) {
  if (lang === 'en') return { title: `${actorName} contributed to the Shared Fund`, body: `+ ${amountStr} in ${spaceName}` }
  return { title: `${actorName} aportó al Fondo Compartido`, body: `+ ${amountStr} en ${spaceName}` }
}

function fundContributionDeletedText(lang, actorName, amountStr, depositorName, spaceName) {
  if (lang === 'en') {
    const clause = depositorName ? ` from ${depositorName}` : ''
    return { title: `${actorName} removed a Fund contribution`, body: `${amountStr}${clause} was removed from ${spaceName}'s Fund` }
  }
  const clause = depositorName ? ` de ${depositorName}` : ''
  return { title: `${actorName} eliminó una aportación al Fondo`, body: `Se quitó ${amountStr}${clause} del Fondo de ${spaceName}` }
}

// ── Contribuciones a pagos compartidos (register-contribution.js) ───────
function paymentUnmarkedText(lang, actorName, paymentName) {
  if (lang === 'en') return { title: `${actorName} unmarked a payment`, body: `${paymentName} is pending again` }
  return { title: `${actorName} desmarcó un pago`, body: `${paymentName} volvió a pendiente` }
}

function variableAmountSetText(lang, actorName, paymentName, amountStr) {
  if (lang === 'en') return { title: `${actorName} set the amount of a variable payment`, body: `${paymentName} — ${amountStr}` }
  return { title: `${actorName} fijó el monto de un pago variable`, body: `${paymentName} — ${amountStr}` }
}

function paidWithFundText(lang, actorName, paymentName, amountStr) {
  if (lang === 'en') return { title: `${actorName} paid with the Shared Fund`, body: `${paymentName} — ${amountStr} from the Fund` }
  return { title: `${actorName} pagó con el Fondo Compartido`, body: `${paymentName} — ${amountStr} desde el Fondo` }
}

function contributionRegisteredText(lang, actorName, paymentName, memberName, amountStr) {
  if (lang === 'en') {
    return { title: `${actorName} recorded a contribution`, body: `${paymentName} — ${memberName} put in ${amountStr}` }
  }
  return { title: `${actorName} registró un abono`, body: `${paymentName} — ${memberName} puso ${amountStr}` }
}

module.exports = {
  resolveLang,
  overdueText, dueTodayText, upcomingText, cobroDayText, goalDeadlineText, trialEndingText,
  paymentTitleText, paymentBodyText,
  joinedText, leftText, removedBroadcastText, removedTargetText,
  permissionsChangedText, spaceConfigChangedText, spaceDeletedText, spaceDataClearedText,
  fundContributionText, fundContributionDeletedText,
  paymentUnmarkedText, variableAmountSetText, paidWithFundText, contributionRegisteredText,
}
