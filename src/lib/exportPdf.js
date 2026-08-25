// jsPDF/jspdf-autotable se cargan DINÁMICAMENTE (import() en vez de import
// estático) — pesan ~800KB juntos, y un import estático aquí los metería en
// el chunk de Ajustes (cargado al abrir esa pestaña) o, peor, en el chunk
// "vendor" cargado en CADA arranque de la app (ver vite.config.js). Con
// import dinámico, solo se descargan la primera vez que alguien de verdad
// toca "Generar PDF" — nadie más paga ese peso. Regla 32 (React.lazy para
// montaje condicional) aplicada aquí a nivel de dependencia, no de página.

// Generador del reporte PDF — Fase 2 de "Exportar datos" (ver CONTEXT.md,
// pendiente "Rediseño de PremiumPage.jsx"). Solo dibuja: recibe datos ya
// resueltos (pagos, ingresos, contribuciones con nombre/avatar, totales por
// miembro, metas) — ninguna consulta a Supabase vive aquí, mismo criterio
// que exportCsv.js.
//
// Paleta del reporte (fija, pensada para imprimirse/verse fuera del tema
// oscuro de la app, NUNCA los colores de --bg/--text del tema oscuro):
const COLOR_DARK   = [2, 10, 31]     // texto/números — SIEMPRE este color, nunca verde/azul (pedido explícito de Johnatan)
const COLOR_MUTED  = [90, 95, 110]
const COLOR_ACCENT = [47, 140, 250]  // var(--accent) tema claro — barras/línea de Gastos, SÍ se conservan a color
const COLOR_GREEN  = [15, 209, 67]   // var(--paid) — línea/acento de Ingresos
const COLOR_PURPLE = [107, 79, 224]  // acento de Balance — 3er color para diferenciar los 3 KPIs entre sí
const COLOR_LIGHT  = [242, 242, 242] // var(--bg) tema claro — fondo de tarjetas/barras vacías
const COLOR_WHITE  = [255, 255, 255]
const COLOR_LINE   = [229, 229, 229]
// Tintes muy claros de cada acento, para el fondo de las tarjetas KPI
// (Johnatan: "diferenciadoras" — cada una con su propio tono, no el mismo
// gris para las 3).
const TINT_GREEN  = [234, 247, 238]
const TINT_ACCENT = [234, 241, 254]
const TINT_PURPLE = [242, 240, 251]

const MARGIN = 15 // mm
const PAGE_W = 215.9 // carta
const PAGE_H = 279.4
const CONTENT_W = PAGE_W - MARGIN * 2

// Meses en español, formato corto — mismo array que MONTHS_SHORT de
// lib/utils.js, duplicado aquí a propósito: este módulo se mantiene sin
// dependencias de otros archivos de la app (mismo criterio que
// exportCsv.js), y es un arreglo literal que no cambia.
const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// Formato de fecha D M A pedido por Johnatan (ej. "19 jul 2026") — todas
// las fechas del reporte (listado de gastos, ingresos, metas) pasan por
// aquí en vez de mostrarse en ISO crudo (YYYY-MM-DD).
function formatShortDate(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number)
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`
}

// ── Helpers de imagen ───────────────────────────────────────────────────
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

// Rasteriza el logo (PNG/SVG) a dataURL vía canvas — jsPDF no dibuja SVG
// directo, así que se resuelve una sola vez al vuelo. Si el archivo no
// existe todavía en public/ (pendiente de que Johnatan lo suba, ver
// CONTEXT.md), regresa null y el caller cae a texto plano — nunca un
// ícono de imagen rota dentro del PDF.
async function loadLogoDataUrl(path) {
  try {
    const img = await loadImage(path)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d').drawImage(img, 0, 0)
    return { dataUrl: canvas.toDataURL('image/png'), ratio: img.naturalWidth / img.naturalHeight }
  } catch {
    return null
  }
}

// Avatar recortado en círculo. Mismo criterio: si falla (sin avatar_url,
// URL caída, CORS), regresa null y el caller dibuja un círculo con
// iniciales en su lugar — nunca deja un hueco ni un ícono roto.
async function loadCircleAvatarDataUrl(url, sizePx = 96) {
  if (!url) return null
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = sizePx
    canvas.height = sizePx
    const ctx = canvas.getContext('2d')
    ctx.save()
    ctx.beginPath()
    ctx.arc(sizePx / 2, sizePx / 2, sizePx / 2, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(img, 0, 0, sizePx, sizePx)
    ctx.restore()
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

// Pre-carga todos los avatares que el reporte va a necesitar (miembros +
// contribuyentes) UNA sola vez al inicio — evita repetir la misma
// descarga/rasterizado si la misma persona aparece en varias filas.
async function preloadAvatars(members) {
  const map = {}
  await Promise.all(members.map(async m => {
    map[m.userId] = await loadCircleAvatarDataUrl(m.avatarUrl, 96)
  }))
  return map
}

function initials(name) {
  return (name || '?').trim().slice(0, 2).toUpperCase()
}

// Dibuja un avatar de `size`mm en (x,y) — imagen si se pudo cargar,
// círculo con iniciales (acento azul, texto blanco) si no.
function drawAvatar(doc, dataUrl, name, x, y, size) {
  if (dataUrl) {
    doc.addImage(dataUrl, 'PNG', x, y, size, size)
  } else {
    doc.setFillColor(...COLOR_ACCENT)
    doc.circle(x + size / 2, y + size / 2, size / 2, 'F')
    doc.setFontSize(size * 2.2)
    doc.setTextColor(...COLOR_WHITE)
    doc.text(initials(name), x + size / 2, y + size / 2 + size * 0.16, { align: 'center' })
  }
}

// ── Utilidades de formato/paginado ──────────────────────────────────────
// Montos con decimales SIEMPRE (pedido explícito de Johnatan) — salvo
// moneyCompact(), que es solo para las etiquetas de la gráfica y se queda
// abreviada ($12.0k).
function money(n) {
  const num = Number(n) || 0
  return '$' + Math.abs(num).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Montos abreviados SOLO para las etiquetas de la gráfica de tendencia —
// bug real detectado (confundía a Johnatan): para montos MENORES a $1,000,
// esta función caía de regreso a money() (que SÍ lleva centavos desde el
// ajuste de decimales), produciendo cosas como "$860.00" mezcladas con
// "$4.9k" en la misma gráfica — dos formatos distintos, y encima con 2
// montos reales pero DIFERENTES (Ingresos vs Gastos de la misma semana)
// tan pegados que se leían como si fueran el mismo dato mal calculado.
// Ahora los montos chicos también van redondos, sin centavos — la
// precisión de centavos vive en los KPI/tablas, no en las etiquetas de la
// gráfica.
function moneyCompact(n) {
  const num = Number(n) || 0
  if (num >= 1000) return '$' + (num / 1000).toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'k'
  return '$' + Math.round(Math.abs(num)).toLocaleString('es-MX')
}

// Si no queda suficiente alto en la página actual, agrega una nueva y
// regresa el Y de inicio (MARGIN); si sí cabe, regresa `y` sin tocar nada.
// Usado antes de cada bloque/fila para que ninguna sección se corte a la
// mitad entre 2 páginas de forma fea.
function ensureSpace(doc, y, neededHeight) {
  if (y + neededHeight > PAGE_H - MARGIN) {
    doc.addPage()
    return MARGIN
  }
  return y
}

function sectionTitle(doc, text, x, y, subtitle) {
  doc.setFontSize(11)
  doc.setTextColor(...COLOR_DARK)
  doc.setFont(undefined, 'bold')
  doc.text(text, x, y)
  doc.setFont(undefined, 'normal')
  y += 4.5
  if (subtitle) {
    doc.setFontSize(7.5)
    doc.setTextColor(...COLOR_MUTED)
    doc.text(subtitle, x, y)
    y += 4
  }
  return y + 1.5
}

// ── Encabezado — logo a la izquierda; a la derecha, el ESPACIO arriba
// (más prominente) y el rango de fechas debajo (más chico, mudo); título
// general grande abajo de todo, con espacio de sobra respecto al logo
// (Johnatan: "el logo queda pegado, casi arriba, del título").
function drawHeader(doc, logo, spaceLabel, fromLabel, toLabel, reportTitle) {
  let y = MARGIN
  if (logo) {
    const h = 7
    const w = h * logo.ratio
    doc.addImage(logo.dataUrl, 'PNG', MARGIN, y - 2, w, h)
  } else {
    doc.setFontSize(12)
    doc.setTextColor(...COLOR_DARK)
    doc.setFont(undefined, 'bold')
    doc.text('LunaPay', MARGIN, y + 3)
    doc.setFont(undefined, 'normal')
  }

  doc.setFontSize(9.5)
  doc.setTextColor(...COLOR_DARK)
  doc.setFont(undefined, 'bold')
  doc.text(spaceLabel, PAGE_W - MARGIN, y + 1, { align: 'right' })
  doc.setFont(undefined, 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...COLOR_MUTED)
  doc.text(`${fromLabel} — ${toLabel}`, PAGE_W - MARGIN, y + 6, { align: 'right' })

  y += 18 // antes +9 — más espacio respecto al logo para que el título no se vea pegado
  doc.setFontSize(17)
  doc.setTextColor(...COLOR_DARK)
  doc.setFont(undefined, 'bold')
  doc.text(reportTitle, MARGIN, y)
  doc.setFont(undefined, 'normal')

  y += 5
  doc.setDrawColor(...COLOR_LINE)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  return y + 10
}

// ── KPIs — SIEMPRE de ancho completo, uno al lado del otro, cada uno con
// su propio tinte/acento para diferenciarse entre sí (pedido explícito de
// Johnatan). El NÚMERO siempre en COLOR_DARK — nunca verde/azul/morado,
// eso solo va en el acento decorativo de la tarjeta.
function drawKpiRow(doc, y, totals, labels) {
  const cards = []
  if (totals.ingresos !== null) cards.push({ label: labels.ingresos, value: totals.ingresos, accent: COLOR_GREEN, tint: TINT_GREEN })
  if (totals.gastos !== null) cards.push({ label: labels.gastos, value: totals.gastos, accent: COLOR_ACCENT, tint: TINT_ACCENT })
  if (totals.ingresos !== null && totals.gastos !== null) cards.push({ label: labels.balance, value: totals.ingresos - totals.gastos, accent: COLOR_PURPLE, tint: TINT_PURPLE })
  if (cards.length === 0) return y

  const gap = 6
  const cardW = (CONTENT_W - gap * (cards.length - 1)) / cards.length
  const cardH = 18
  let x = MARGIN
  for (const card of cards) {
    doc.setFillColor(...card.tint)
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'F')
    doc.setFillColor(...card.accent)
    doc.roundedRect(x, y, 1.6, cardH, 0.8, 0.8, 'F')
    doc.setFontSize(8.5)
    doc.setTextColor(...COLOR_MUTED)
    doc.text(card.label, x + 6, y + 7)
    doc.setFontSize(13)
    doc.setTextColor(...COLOR_DARK)
    doc.setFont(undefined, 'bold')
    doc.text(money(card.value), x + 6, y + 14)
    doc.setFont(undefined, 'normal')
    x += cardW + gap
  }
  return y + cardH + 10
}

// ── Categorías (izquierda) + gráfica de tendencia (derecha) ─────────────
function drawCategoriesAndTrend(doc, y, { categories, series, labels }) {
  const colW = (CONTENT_W - 10) / 2
  const leftX = MARGIN
  const rightX = MARGIN + colW + 10
  let leftY = y
  let rightY = y

  // Gastos por categoría — TODAS, ordenadas de mayor a menor, sin recorte
  // (Johnatan: "eso de +N categorías más aquí no aplica, no podrán
  // desplegarlo" — un PDF es estático). Si no caben en esta columna,
  // continúan en una sección aparte de ancho completo más abajo (ver
  // drawRemainingCategories).
  let shownCategories = []
  if (categories.length > 0) {
    leftY = sectionTitle(doc, labels.categoryChart, leftX, leftY, labels.subCategoryChart)
    const maxAmount = categories[0].amount
    const rowH = 6
    const availableRows = Math.max(0, Math.floor((PAGE_H - MARGIN - leftY) / rowH))
    shownCategories = categories.slice(0, availableRows)
    for (const cat of shownCategories) {
      doc.setFontSize(7.5)
      doc.setTextColor(...COLOR_DARK)
      doc.text(cat.label, leftX, leftY)
      doc.text(money(cat.amount), leftX + colW, leftY, { align: 'right' })
      doc.setFillColor(...COLOR_LIGHT)
      doc.roundedRect(leftX, leftY + 1, colW, 2.2, 1, 1, 'F')
      const w = maxAmount > 0 ? (cat.amount / maxAmount) * colW : 0
      doc.setFillColor(...COLOR_ACCENT)
      if (w > 0) doc.roundedRect(leftX, leftY + 1, w, 2.2, 1, 1, 'F')
      leftY += rowH
    }
  }

  if (series) {
    rightY = sectionTitle(doc, labels.trendChart, rightX, rightY, labels.subTrendChart)
    rightY = drawTrendChart(doc, rightX, rightY, colW, series, labels)
  }

  return {
    nextY: Math.max(leftY, rightY) + 4,
    remainingCategories: categories.slice(shownCategories.length),
  }
}

// Gráfica de línea combinada (Gastos + Ingresos) — SIEMPRE independiente
// del filtro de fechas del reporte (ver buildTrendSeries() en
// SettingsExportPage.jsx: mira hasta 12 meses atrás desde `to`, se adapta
// solo a semana/día si hay poca actividad para no verse como una línea
// plana de 1-2 puntos). Con puntos + monto rotulado en cada uno (pedido
// explícito de Johnatan) — Ingresos arriba de su punto, Gastos abajo, para
// que no se encimen los textos.
function drawTrendChart(doc, x, y, width, series, labels) {
  const { points } = series
  const chartH = 34
  const labelPad = 9 // espacio reservado arriba/abajo para los montos rotulados
  const top = y + labelPad
  const bottom = top + chartH
  const maxAmount = Math.max(...points.map(p => Math.max(p.gastos, p.ingresos)), 1)
  const stepX = points.length > 1 ? width / (points.length - 1) : 0
  const showLabels = points.length <= 14 // con más puntos (ej. 30 días) el texto ya no cabe sin encimarse
  const labelEvery = Math.max(1, Math.ceil(points.length / 8)) // con muchos puntos (30 días), solo 1 de cada N para no amontonar

  // Cuadrícula tenue de referencia (una línea vertical por mes/punto
  // marcado en el eje X) — pedido de Johnatan para ubicar a qué mes
  // pertenece cada monto. Se dibuja ANTES que las líneas/puntos/montos,
  // para quedar siempre detrás.
  doc.setDrawColor(235, 235, 235)
  doc.setLineWidth(0.2)
  points.forEach((p, i) => {
    if (i % labelEvery === 0 || i === points.length - 1) {
      doc.line(x + stepX * i, top, x + stepX * i, bottom)
    }
  })

  function plot(key) {
    return points.map((p, i) => ({
      x: x + stepX * i,
      y: bottom - (p[key] / maxAmount) * chartH,
      value: p[key],
    }))
  }

  function drawLine(coords, color) {
    doc.setDrawColor(...color)
    doc.setLineWidth(0.6)
    for (let i = 0; i < coords.length - 1; i++) {
      doc.line(coords[i].x, coords[i].y, coords[i + 1].x, coords[i + 1].y)
    }
    for (const c of coords) {
      doc.setFillColor(...color)
      doc.circle(c.x, c.y, 1.1, 'F')
    }
  }

  const ingresosCoords = plot('ingresos')
  const gastosCoords = plot('gastos')
  drawLine(ingresosCoords, COLOR_GREEN)
  drawLine(gastosCoords, COLOR_ACCENT)

  // Monto rotulado con fondo blanco detrás (pedido de Johnatan: "para no
  // complicarnos la vida" con la posición exacta — un fondo blanco lo hace
  // legible sin importar si cae encima de una línea o de otra etiqueta).
  // NUNCA en $0: una racha de meses/semanas sin movimiento se ve como una
  // fila de "$0" amontonada contra el eje X; omitir esas etiquetas no
  // pierde información real (ya se ve la línea plana en $0).
  function drawAmountLabel(text, cx, cy) {
    doc.setFontSize(6)
    const w = doc.getTextWidth(text)
    doc.setFillColor(...COLOR_WHITE)
    doc.rect(cx - w / 2 - 0.8, cy - 2.4, w + 1.6, 3.1, 'F')
    doc.setTextColor(...COLOR_DARK)
    doc.text(text, cx, cy, { align: 'center' })
  }

  // Monto rotulado con fondo blanco detrás (v0.9.433). Ahora además: si los
  // 2 puntos (Ingresos/Gastos) de un mismo punto en X quedan muy cerca en
  // altura, sus 2 etiquetas se separan a la fuerza (simétrico alrededor del
  // punto medio) — antes cada una solo se offsetaba respecto a SU propio
  // punto, así que 2 líneas casi pegadas seguían produciendo 2 etiquetas
  // casi pegadas entre sí (visto en captura de Johnatan).
  const MIN_LABEL_GAP = 5 // mm entre los centros de las 2 etiquetas
  if (showLabels) {
    for (let i = 0; i < points.length; i++) {
      const ing = ingresosCoords[i]
      const gas = gastosCoords[i]
      let ingLabelY = ing.y - 1.8
      let gasLabelY = gas.y + 3.8
      if (ing.value > 0 && gas.value > 0 && (gasLabelY - ingLabelY) < MIN_LABEL_GAP) {
        const mid = (ingLabelY + gasLabelY) / 2
        ingLabelY = mid - MIN_LABEL_GAP / 2
        gasLabelY = mid + MIN_LABEL_GAP / 2
      }
      if (ing.value > 0) drawAmountLabel(moneyCompact(ing.value), ing.x, ingLabelY)
      if (gas.value > 0) drawAmountLabel(moneyCompact(gas.value), gas.x, gasLabelY)
    }
  }

  // Eje X — mismo criterio de "cabe o no cabe" que las etiquetas de monto.
  doc.setFontSize(6.5)
  doc.setTextColor(...COLOR_MUTED)
  points.forEach((p, i) => {
    if (i % labelEvery === 0 || i === points.length - 1) {
      doc.text(p.label, x + stepX * i, bottom + 6, { align: 'center' })
    }
  })

  // Leyenda
  const legendY = bottom + 12
  doc.setFillColor(...COLOR_GREEN)
  doc.circle(x + 2, legendY - 1, 1.2, 'F')
  doc.setFontSize(7)
  doc.setTextColor(...COLOR_MUTED)
  doc.text(labels.ingresos, x + 5, legendY)
  const gastosLegendX = x + 5 + doc.getTextWidth(labels.ingresos) + 6
  doc.setFillColor(...COLOR_ACCENT)
  doc.circle(gastosLegendX, legendY - 1, 1.2, 'F')
  doc.text(labels.gastos, gastosLegendX + 3, legendY)

  return legendY + 4
}

// Continuación de categorías que no cupieron en la columna de la página 1
// — ancho completo, nunca se ocultan ni se resumen en "+N más".
function drawRemainingCategories(doc, y, categories, labels) {
  if (categories.length === 0) return y
  y = ensureSpace(doc, y, 14)
  y = sectionTitle(doc, labels.categoryChartContinued, MARGIN, y)
  const maxAmount = Math.max(...categories.map(c => c.amount), 1)
  const rowH = 6
  for (const cat of categories) {
    y = ensureSpace(doc, y, rowH)
    doc.setFontSize(8)
    doc.setTextColor(...COLOR_DARK)
    doc.text(cat.label, MARGIN, y)
    doc.text(money(cat.amount), PAGE_W - MARGIN, y, { align: 'right' })
    doc.setFillColor(...COLOR_LIGHT)
    doc.roundedRect(MARGIN, y + 1, CONTENT_W, 2.5, 1, 1, 'F')
    const w = (cat.amount / maxAmount) * CONTENT_W
    doc.setFillColor(...COLOR_ACCENT)
    if (w > 0) doc.roundedRect(MARGIN, y + 1, w, 2.5, 1, 1, 'F')
    y += rowH
  }
  return y + 4
}

// ── Listado de gastos (tabla completa, con aportantes si aplica) ────────
// "Pagado" es ahora la ÚNICA columna de fecha (antes había "Fecha" +
// "Pagado" Sí/No por separado — Johnatan: "no entiendo la funcionalidad de
// poner Sí o No"): muestra la fecha real en que se pagó, o "Pendiente" si
// sigue sin pagarse. Formato D M A en toda la tabla.
function drawExpenseList(doc, y, { rows, contributorsByRow, isSharedSpace, labels, autoTableFn }) {
  y = ensureSpace(doc, y, 14)
  y = sectionTitle(doc, labels.expenseList, MARGIN, y, labels.subExpenseList)

  const head = isSharedSpace
    ? [[labels.colPaid, labels.colName, labels.colCategory, labels.colAmount, labels.colContributors]]
    : [[labels.colPaid, labels.colName, labels.colCategory, labels.colAmount]]

  const body = rows.map(r => {
    const paidCell = r.paidDate ? formatShortDate(r.paidDate) : labels.pending
    return isSharedSpace
      ? [paidCell, r.name, r.category, money(r.amount), '']
      : [paidCell, r.name, r.category, money(r.amount)]
  })

  const contributorsColIndex = isSharedSpace ? 4 : null

  autoTableFn(doc, {
    startY: y,
    head,
    body,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'plain',
    styles: { fontSize: 7.5, textColor: COLOR_DARK, cellPadding: 1.6, minCellHeight: isSharedSpace ? 8 : 5 },
    headStyles: { fillColor: COLOR_LIGHT, textColor: COLOR_MUTED, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 249, 249] },
    columnStyles: isSharedSpace ? { 3: { halign: 'right', cellWidth: 22 }, 4: { cellWidth: 45 } } : { 3: { halign: 'right', cellWidth: 22 } },
    didDrawCell(data) {
      if (!isSharedSpace || data.section !== 'body' || data.column.index !== contributorsColIndex) return
      const contributors = contributorsByRow[data.row.index] || []
      let cx = data.cell.x + 1
      const cy = data.cell.y + data.cell.height / 2 - 2
      for (const c of contributors.slice(0, 3)) {
        drawAvatar(doc, c.avatarDataUrl, c.name, cx, cy, 4)
        doc.setFontSize(6.5)
        doc.setTextColor(...COLOR_DARK)
        doc.text(money(c.amount), cx + 5, cy + 3)
        cx += 5 + doc.getTextWidth(money(c.amount)) + 3
      }
    },
  })

  return doc.lastAutoTable.finalY + 8
}

// ── Gasto por miembro (solo Espacio Compartido) ─────────────────────────
function drawMemberSpending(doc, y, memberTotals, labels) {
  if (memberTotals.length === 0) return y
  y = ensureSpace(doc, y, 14)
  y = sectionTitle(doc, labels.memberSpending, MARGIN, y, labels.subMemberSpending)
  const maxAmount = Math.max(...memberTotals.map(m => m.total), 1)
  const rowH = 10

  for (const m of memberTotals) {
    y = ensureSpace(doc, y, rowH)
    drawAvatar(doc, m.avatarDataUrl, m.name, MARGIN, y, 7)
    doc.setFontSize(8.5)
    doc.setTextColor(...COLOR_DARK)
    doc.text(m.name, MARGIN + 10, y + 3)
    doc.text(money(m.total), PAGE_W - MARGIN, y + 3, { align: 'right' })
    const barX = MARGIN + 10
    const barW = CONTENT_W - 10
    doc.setFillColor(...COLOR_LIGHT)
    doc.roundedRect(barX, y + 4.5, barW, 2.2, 1, 1, 'F')
    const w = (m.total / maxAmount) * barW
    doc.setFillColor(...COLOR_ACCENT)
    if (w > 0) doc.roundedRect(barX, y + 4.5, w, 2.2, 1, 1, 'F')
    y += rowH
  }
  return y + 4
}

// ── Ingresos (tabla) ─────────────────────────────────────────────────────
function drawIncomeTable(doc, y, incomes, labels, autoTableFn) {
  if (incomes.length === 0) return y
  y = ensureSpace(doc, y, 14)
  y = sectionTitle(doc, labels.ingresos, MARGIN, y, labels.subIncome)
  autoTableFn(doc, {
    startY: y,
    head: [[labels.colDate, labels.colType, labels.colNote, labels.colAmount]],
    body: incomes.map(i => [formatShortDate(i.date), i.type, i.note || '', money(i.amount)]),
    margin: { left: MARGIN, right: MARGIN },
    theme: 'plain',
    styles: { fontSize: 7.5, textColor: COLOR_DARK, cellPadding: 1.6 },
    headStyles: { fillColor: COLOR_LIGHT, textColor: COLOR_MUTED, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 249, 249] },
    columnStyles: { 3: { halign: 'right', cellWidth: 24 } },
  })
  return doc.lastAutoTable.finalY + 8
}

// ── Metas (resumen + abonos + retiros) ──────────────────────────────────
function drawGoalsSection(doc, y, goals, labels, autoTableFn) {
  y = ensureSpace(doc, y, 14)
  y = sectionTitle(doc, labels.goalsTitle, MARGIN, y, labels.subGoals)

  doc.setFontSize(8)
  doc.setTextColor(...COLOR_MUTED)
  doc.text(`${labels.created}: ${goals.created.length}`, MARGIN, y)
  doc.text(`${labels.completed}: ${goals.completed.length}`, MARGIN + 45, y)
  y += 8

  if (goals.aportes.length > 0) {
    y = ensureSpace(doc, y, 14)
    doc.setFontSize(9)
    doc.setTextColor(...COLOR_DARK)
    doc.text(labels.contributions, MARGIN, y)
    y += 4
    autoTableFn(doc, {
      startY: y,
      head: [[labels.colDate, labels.colGoal, labels.colAmount]],
      body: goals.aportes.map(a => [formatShortDate(a.date), a.goalName, money(a.amount)]),
      margin: { left: MARGIN, right: MARGIN },
      theme: 'plain',
      styles: { fontSize: 7.5, textColor: COLOR_DARK, cellPadding: 1.6 },
      headStyles: { fillColor: COLOR_LIGHT, textColor: COLOR_MUTED, fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right', cellWidth: 24 } },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  if (goals.retiros.length > 0) {
    y = ensureSpace(doc, y, 14)
    doc.setFontSize(9)
    doc.setTextColor(...COLOR_DARK)
    doc.text(labels.withdrawals, MARGIN, y)
    y += 4
    autoTableFn(doc, {
      startY: y,
      head: [[labels.colDate, labels.colGoal, labels.colAmount]],
      body: goals.retiros.map(r => [formatShortDate(r.date), r.goalName, money(r.amount)]),
      margin: { left: MARGIN, right: MARGIN },
      theme: 'plain',
      styles: { fontSize: 7.5, textColor: COLOR_DARK, cellPadding: 1.6 },
      headStyles: { fillColor: COLOR_LIGHT, textColor: COLOR_MUTED, fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right', cellWidth: 24 } },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  return y
}

// ── Pie de página (número de página, en todas) ──────────────────────────
function drawPageNumbers(doc) {
  const count = doc.internal.getNumberOfPages()
  for (let i = 1; i <= count; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5)
    doc.setTextColor(...COLOR_MUTED)
    doc.text(`${i} / ${count}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' })
  }
}

// ── Entrada principal ────────────────────────────────────────────────────
// Todos los datos ya vienen resueltos por SettingsExportPage.jsx (consultas
// a Supabase, cruce de nombres/avatares) — esta función solo dibuja.
export async function generateReportPdf({
  spaceLabel, fromLabel, toLabel, isSharedSpace,
  totals, categories, series, // series: { granularity: 'month'|'week'|'day', points: [{label, gastos, ingresos}] } | null
  expenseRows, expenseContributors, // expenseContributors[i] = [{userId, name, avatarUrl, amount}]
  memberTotals, // [{ userId, name, avatarUrl, total }]
  incomes,
  goals, // null si no se incluyeron, o { created, completed, aportes, retiros }
  labels, // todos los textos ya traducidos, ver SettingsExportPage.jsx
}) {
  // Import dinámico — ver nota arriba del archivo. `jspdf-autotable` se
  // auto-registra como plugin de la instancia de jsPDF al importarse
  // (mismo mecanismo que si fuera <script> global), pero en un bundle ESM
  // hay que llamar la función exportada directo (`autoTableFn(doc, opts)`)
  // en vez de `doc.autoTable(opts)` — más explícito y no depende de que el
  // side-effect de registro haya corrido a tiempo.
  const [{ jsPDF }, { default: autoTableFn }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc = new jsPDF({ unit: 'mm', format: 'letter' })

  // Pre-carga de avatares — una sola vez, se reutiliza en el listado y en
  // "Gasto por miembro".
  const avatarSubjects = [
    ...memberTotals.map(m => ({ userId: m.userId, avatarUrl: m.avatarUrl })),
    ...expenseContributors.flat().map(c => ({ userId: c.userId, avatarUrl: c.avatarUrl })),
  ]
  const avatarMap = await preloadAvatars(avatarSubjects)
  const withAvatar = (obj) => ({ ...obj, avatarDataUrl: avatarMap[obj.userId] || null })

  const logo = await loadLogoDataUrl('/LunaPay_logo_horizontal_dark.png')

  let y = drawHeader(doc, logo, spaceLabel, fromLabel, toLabel, labels.reportTitle)
  y = drawKpiRow(doc, y, totals, labels)

  const { nextY, remainingCategories } = drawCategoriesAndTrend(doc, y, { categories, series, labels })
  y = nextY
  y = drawRemainingCategories(doc, y, remainingCategories, labels)

  if (expenseRows.length > 0) {
    const contributorsByRow = expenseContributors.map(list => list.map(withAvatar))
    y = drawExpenseList(doc, y, { rows: expenseRows, contributorsByRow, isSharedSpace, labels, autoTableFn })
  }

  if (isSharedSpace && memberTotals.length > 0) {
    y = drawMemberSpending(doc, y, memberTotals.map(withAvatar), labels)
  }

  if (incomes.length > 0) {
    y = drawIncomeTable(doc, y, incomes, labels, autoTableFn)
  }

  if (goals) {
    y = drawGoalsSection(doc, y, goals, labels, autoTableFn)
  }

  drawPageNumbers(doc)

  return doc
}
