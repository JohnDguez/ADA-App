// (v0.9.1012) Lee la llave de la cuenta de servicio aunque en Vercel se haya
// pegado con otro formato: JSON de una línea (lo correcto), con comillas
// alrededor, con saltos de línea reales dentro de la clave privada, o el JSON
// en base64. Antes cualquiera de esos casos truena con "no es un JSON válido".
function parseServiceAccountKey(raw) {
  let text = String(raw).trim()
  if (text.length > 1 && /^(["'`]).*\1$/s.test(text)) text = text.slice(1, -1).trim()
  const attempts = [
    () => JSON.parse(text),
    () => JSON.parse(text.replace(/\r?\n/g, '\\n')),
    () => JSON.parse(Buffer.from(text, 'base64').toString('utf8')),
  ]
  for (const attempt of attempts) {
    try {
      const value = attempt()
      if (value && typeof value === 'object') return value
    } catch (e) {
      // se prueba el siguiente formato
    }
  }
  return null
}

module.exports = { parseServiceAccountKey }
