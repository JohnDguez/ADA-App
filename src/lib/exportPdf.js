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
const COLOR_ACCENT = [47, 140, 250]  // var(--accent) tema claro — barras y acentos de color SÍ se conservan
const COLOR_GREEN  = [15, 209, 67]   // var(--paid) — punto de acento de "Ingresos"
const COLOR_LIGHT  = [242, 242, 242] // var(--bg) tema claro — fondo de tarjetas/barras vacías
const COLOR_WHITE  = [255, 255, 255]
const COLOR_LINE   = [229, 229, 229]

const MARGIN = 15 // mm
const PAGE_W = 215.9 // carta
const PAGE_H = 279.4
const CONTENT_W = PAGE_W - MARGIN * 2

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
function money(n) {
  const num = Number(n) || 0
  return '$' + Math.abs(num).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function moneyCompact(n) {
  const num = Number(n) || 0
  if (num >= 1000) return '$' + (num / 1000).toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'k'
  return money(num)
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

function sectionTitle(doc, text, x, y) {
  doc.setFontSize(11)
  doc.setTextColor(...COLOR_DARK)
  doc.setFont(undefined, 'bold')
  doc.text(text, x, y)
  doc.setFont(undefined, 'normal')
  return y + 6
}

// ── Encabezado (se repite en cada página nueva de contenido propio) ─────
function drawHeader(doc, logo, spaceLabel, fromLabel, toLabel) {
  let y = MARGIN
  if (logo) {
    const h = 8
    const w = h * logo.ratio
    doc.addImage(logo.dataUrl, 'PNG', MARGIN, y - 2, w, h)
  } else {
    doc.setFontSize(14)
    doc.setTextColor(...COLOR_DARK)
    doc.setFont(undefined, 'bold')
    doc.text('LunaPay', MARGIN, y + 4)
    doc.setFont(undefined, 'normal')
  }
  doc.setFontSize(8)
  doc.setTextColor(...COLOR_MUTED)
  doc.text(`${spaceLabel} · ${fromLabel} — ${toLabel}`, PAGE_W - MARGIN, y + 3, { align: 'right' })
  doc.setDrawColor(...COLOR_LINE)
  doc.line(MARGIN, y + 8, PAGE_W - MARGIN, y + 8)
  return y + 16
}

// ── Página 1: resumen + gastos por categoría + gastos por mes ───────────
function drawSummaryAndCharts(doc, y, { totals, categories, months, labels }) {
  const colW = (CONTENT_W - 10) / 2
  const leftX = MARGIN
  const rightX = MARGIN + colW + 10
  let leftY = y
  let rightY = y

  // Resumen — puntos de acento SÍ llevan color (verde Ingresos, azul
  // Gastos/Balance); el monto en sí siempre en COLOR_DARK, pedido
  // explícito de Johnatan ("los números sin verdes ni azules").
  const cards = []
  if (totals.ingresos !== null) cards.push({ label: labels.ingresos, value: totals.ingresos, dot: COLOR_GREEN })
  if (totals.gastos !== null) cards.push({ label: labels.gastos, value: totals.gastos, dot: COLOR_ACCENT })
  if (totals.ingresos !== null && totals.gastos !== null) cards.push({ label: labels.balance, value: totals.ingresos - totals.gastos, dot: COLOR_ACCENT })

  for (const card of cards) {
    doc.setFillColor(...COLOR_LIGHT)
    doc.roundedRect(leftX, leftY, colW, 10, 1.5, 1.5, 'F')
    doc.setFillColor(...card.dot)
    doc.circle(leftX + 4, leftY + 5, 1.3, 'F')
    doc.setFontSize(8)
    doc.setTextColor(...COLOR_MUTED)
    doc.text(card.label, leftX + 8, leftY + 4)
    doc.setFontSize(11)
    doc.setTextColor(...COLOR_DARK)
    doc.setFont(undefined, 'bold')
    doc.text(money(card.value), leftX + 8, leftY + 8.5)
    doc.setFont(undefined, 'normal')
    leftY += 12
  }
  leftY += 4

  // Gastos por categoría — TODAS, ordenadas de mayor a menor, sin recorte
  // (Johnatan: "eso de +N categorías más aquí no aplica, no podrán
  // desplegarlo" — un PDF es estático). Si no caben en esta columna,
  // continúan en una sección aparte de ancho completo más abajo (ver
  // drawRemainingCategories).
  let shownCategories = []
  if (categories.length > 0) {
    leftY = sectionTitle(doc, labels.categoryChart, leftX, leftY)
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

  // Gastos por mes — barras con el TOTAL de cada mes rotulado arriba
  // (pedido explícito de Johnatan).
  if (months.length > 0) {
    rightY = sectionTitle(doc, labels.monthlyChart, rightX, rightY)
    const chartH = 32
    const maxAmount = Math.max(...months.map(m => m.amount), 1)
    const barW = Math.min(14, (colW - (months.length - 1) * 4) / months.length)
    const gap = months.length > 1 ? (colW - barW * months.length) / (months.length - 1) : 0
    let bx = rightX
    for (const m of months) {
      const h = (m.amount / maxAmount) * chartH
      doc.setFontSize(6.5)
      doc.setTextColor(...COLOR_DARK)
      doc.text(moneyCompact(m.amount), bx + barW / 2, rightY + (chartH - h) - 1.5, { align: 'center' })
      doc.setFillColor(...COLOR_ACCENT)
      doc.rect(bx, rightY + (chartH - h), barW, h, 'F')
      doc.setFontSize(6.5)
      doc.setTextColor(...COLOR_MUTED)
      doc.text(m.label, bx + barW / 2, rightY + chartH + 4, { align: 'center' })
      bx += barW + gap
    }
    rightY += chartH + 8
  }

  return {
    nextY: Math.max(leftY, rightY) + 4,
    remainingCategories: categories.slice(shownCategories.length),
  }
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
function drawExpenseList(doc, y, { rows, contributorsByRow, isSharedSpace, labels, autoTableFn }) {
  y = ensureSpace(doc, y, 14)
  y = sectionTitle(doc, labels.expenseList, MARGIN, y)

  const head = isSharedSpace
    ? [[labels.colDate, labels.colName, labels.colCategory, labels.colAmount, labels.colPaid, labels.colContributors]]
    : [[labels.colDate, labels.colName, labels.colCategory, labels.colAmount, labels.colPaid]]

  const body = rows.map(r => isSharedSpace
    ? [r.date, r.name, r.category, money(r.amount), r.paid ? labels.yes : labels.no, '']
    : [r.date, r.name, r.category, money(r.amount), r.paid ? labels.yes : labels.no])

  autoTableFn(doc, {
    startY: y,
    head,
    body,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'plain',
    styles: { fontSize: 7.5, textColor: COLOR_DARK, cellPadding: 1.6, minCellHeight: isSharedSpace ? 8 : 5 },
    headStyles: { fillColor: COLOR_LIGHT, textColor: COLOR_MUTED, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 249, 249] },
    columnStyles: isSharedSpace ? { 3: { halign: 'right' }, 5: { cellWidth: 45 } } : { 3: { halign: 'right' } },
    didDrawCell(data) {
      if (!isSharedSpace || data.section !== 'body') return
      const isAportantesCol = data.column.index === 5
      if (!isAportantesCol) return
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
  y = sectionTitle(doc, labels.memberSpending, MARGIN, y)
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
  y = sectionTitle(doc, labels.ingresos, MARGIN, y)
  autoTableFn(doc, {
    startY: y,
    head: [[labels.colDate, labels.colType, labels.colNote, labels.colAmount]],
    body: incomes.map(i => [i.date, i.type, i.note || '', money(i.amount)]),
    margin: { left: MARGIN, right: MARGIN },
    theme: 'plain',
    styles: { fontSize: 7.5, textColor: COLOR_DARK, cellPadding: 1.6 },
    headStyles: { fillColor: COLOR_LIGHT, textColor: COLOR_MUTED, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 249, 249] },
    columnStyles: { 3: { halign: 'right' } },
  })
  return doc.lastAutoTable.finalY + 8
}

// ── Metas (resumen + abonos + retiros) ──────────────────────────────────
function drawGoalsSection(doc, y, goals, labels, autoTableFn) {
  y = ensureSpace(doc, y, 14)
  y = sectionTitle(doc, labels.goalsTitle, MARGIN, y)

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
      body: goals.aportes.map(a => [a.date, a.goalName, money(a.amount)]),
      margin: { left: MARGIN, right: MARGIN },
      theme: 'plain',
      styles: { fontSize: 7.5, textColor: COLOR_DARK, cellPadding: 1.6 },
      headStyles: { fillColor: COLOR_LIGHT, textColor: COLOR_MUTED, fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right' } },
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
      body: goals.retiros.map(r => [r.date, r.goalName, money(r.amount)]),
      margin: { left: MARGIN, right: MARGIN },
      theme: 'plain',
      styles: { fontSize: 7.5, textColor: COLOR_DARK, cellPadding: 1.6 },
      headStyles: { fillColor: COLOR_LIGHT, textColor: COLOR_MUTED, fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right' } },
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
  totals, categories, months,
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

  let y = drawHeader(doc, logo, spaceLabel, fromLabel, toLabel)

  const { nextY, remainingCategories } = drawSummaryAndCharts(doc, y, { totals, categories, months, labels })
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
