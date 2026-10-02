// Utilidades genéricas de exportación a CSV — usadas por
// SettingsExportPage.jsx (Fase 1 del módulo de Reportes, ver CONTEXT.md).
// Sin librería externa: un CSV no necesita más que escapar comillas/comas/
// saltos de línea y armar las filas separadas por coma.

import { saveOrShareBlob } from './nativeExport'

// Escapa un valor para una celda CSV: si trae coma, comilla o salto de
// línea, se envuelve en comillas dobles (duplicando cualquier comilla
// interna, regla estándar de CSV). `null`/`undefined` se vuelven celda
// vacía, nunca la palabra "null" literal.
function escapeCsvValue(val) {
  const str = val === null || val === undefined ? '' : String(val)
  if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"'
  return str
}

// `rows`: arreglo de arreglos (mismo orden que `headers`) — no objetos, para
// que el caller controle el orden de columnas explícitamente.
export function buildCsv(headers, rows) {
  const lines = [headers.map(escapeCsvValue).join(',')]
  for (const row of rows) lines.push(row.map(escapeCsvValue).join(','))
  return lines.join('\n')
}

// Dispara la descarga real (web/PWA) o guarda+comparte (Android nativo, ver
// nativeExport.js — octubre 2026: el truco de Blob + link temporal de abajo
// nunca funcionó dentro del WebView de Capacitor, por eso "Descargar CSV"
// no hacía nada en la app instalada). El BOM al inicio del Blob es
// necesario para que Excel en Windows detecte UTF-8 solo — sin él, asume
// Latin-1 y los acentos/ñ del archivo salen corruptos al abrirlo, aunque
// el archivo en sí esté codificado bien. Ahora es async — el caller debe
// hacer `await` (y envolver en try/catch: puede lanzar, ver nativeExport.js).
export async function downloadCsv(filename, csvString) {
  const BOM = '﻿'
  const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' })
  await saveOrShareBlob(filename, blob, 'text/csv')
}
