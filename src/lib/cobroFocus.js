// Pide que, al abrir Ajustes › Periodo de cobro, la pantalla baje hasta la sección
// del día de cobro y la resalte un momento (v0.9.1052). Una sola vez: quien la
// abre llama requestCobroFocus() y SettingsCobroPage la consume al montarse.
let pending = false
export function requestCobroFocus() { pending = true }
export function consumeCobroFocus() { const p = pending; pending = false; return p }
