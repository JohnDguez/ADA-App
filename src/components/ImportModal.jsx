import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, FileSpreadsheet, Search, ChevronLeft, ChevronDown, Repeat, Check } from 'lucide-react'
import { UploadSimple } from '@phosphor-icons/react/dist/csr/UploadSimple'
import { BottomSheet } from './BottomSheet'
import { Collapse } from './Collapse'
import { Toggle } from './SettingsShared'
import { LoadingDots } from './LoadingDots'
import { switchProps } from '../lib/a11y'
import { showToast } from './Toast'
import {
  decodeCsvBuffer, detectDelimiter, parseCsv, detectHeaderRow, guessMapping, isOwnExport,
  detectDateFormat, parseDate, buildImportRows, guessNegativeIsExpense, detectRecurring,
  groupByConcept, headerSignature, strip,
} from '../lib/importCsv'
import { CATEGORIES, getCategoryLabel, getCatColor, fmt, todayStr, cobroPeriod, dateToStr, dateOf, getMonths, intlLocale } from '../lib/utils'
import { catInk } from '../lib/colorUtils'
import { getCategoryIcon } from '../lib/categoryIcons'
import { SettingsSubLayout, SkSeg, useSettingsMode } from './SettingsSubLayout'
import kit from './SettingsKit.module.css'
import styles from './ImportModal.module.css'

// Importar desde un CSV (v0.9.802; subpágina de Ajustes en los 3 tamaños
// desde v0.9.978) — hasta 4 pasos (Archivo · Columnas · Revisión · Pagos que
// se repiten). En tablet/escritorio el resumen va FIJO a la derecha (Regla 48)
// y la lista en formato fila (Regla 47). La lista hace scroll por dentro:
// nunca hace crecer la página. Todo se procesa en el dispositivo.

const MAX_ROWS = 5000
const ROLE_LIST = ['date', 'concept', 'amount', 'debit', 'credit', 'category', 'none']
const MAX_BYTES = 5 * 1024 * 1024
const MAP_KEY = 'lunapay_import_maps_v1'
const ITEM_H_PHONE = 62
const ITEM_H_WIDE = 56
const OVERSCAN = 6

// El mapeo confirmado se recuerda por firma de cabeceras (mismo banco/app =
// no hay que volver a configurar). El almacenamiento puede fallar o estar
// vacío (ventana privada, datos bloqueados): se ignora en silencio.
function readSavedMap(sig) {
  try { return JSON.parse(localStorage.getItem(MAP_KEY) || '{}')[sig] || null } catch { return null }
}
function writeSavedMap(sig, value) {
  try {
    const all = JSON.parse(localStorage.getItem(MAP_KEY) || '{}')
    all[sig] = value
    localStorage.setItem(MAP_KEY, JSON.stringify(all))
  } catch { /* sin almacenamiento disponible: solo se pierde la comodidad de recordar */ }
}

function fmtShort(str) {
  return dateOf(str).toLocaleDateString(intlLocale(), { day: '2-digit', month: 'short' }).replace('.', '').replace('-', ' ')
}

// Lista con ventana: solo se pintan las filas visibles (+ colchón). Todas las
// filas miden lo mismo (itemH), así que basta aritmética. Con 500+ movimientos
// el DOM sigue siendo de ~20 nodos.
function VirtualList({ items, itemH, renderItem, resetKey }) {
  const ref = useRef(null)
  const [top, setTop] = useState(0)
  const [h, setH] = useState(480)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    setH(el.clientHeight || 480)
    const ro = new ResizeObserver(() => setH(el.clientHeight || 480))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => { if (ref.current) { ref.current.scrollTop = 0; setTop(0) } }, [resetKey])
  const start = Math.max(0, Math.floor(top / itemH) - OVERSCAN)
  const end = Math.min(items.length, Math.ceil((top + h) / itemH) + OVERSCAN)
  return (
    <div ref={ref} className={`scroll-y ${styles.list}`} onScroll={e => setTop(e.currentTarget.scrollTop)}>
      <div style={{ height: start * itemH }} />
      {items.slice(start, end).map(renderItem)}
      <div style={{ height: Math.max(0, items.length - end) * itemH }} />
    </div>
  )
}

function CategoryChip({ cat, profile, customCategories, big = false }) {
  const color = getCatColor(cat, customCategories, profile?.category_colors)
  const Icon = getCategoryIcon(cat, profile?.category_icons)
  return (
    <span className={`${styles.catSquare} ${big ? styles.catBig : ''}`} style={{ background: color }}>
      {Icon ? <Icon size={big ? 18 : 13} color={catInk(color)} strokeWidth={2} /> : <span className={styles.catDot} />}
    </span>
  )
}

// ── Contenido (se monta dentro de <Presence>: su estado se reinicia al cerrar) ──
function ImportBody({ profile, sharedActive, onClose, onImport, onFetchExisting, onBack, slideClass }) {
  const { t } = useTranslation()
  const mode = useSettingsMode()
  const itemH = mode === 'mobile' ? ITEM_H_PHONE : ITEM_H_WIDE
  const customCategories = profile?.custom_categories || []
  const fileRef = useRef(null)

  const [step, setStep] = useState('file') // file | columns | review | recurring
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')

  // Archivo leído
  const [table, setTable] = useState([])        // filas de datos (sin cabecera)
  const [headers, setHeaders] = useState([])
  const [firstLine, setFirstLine] = useState(2)
  const [own, setOwn] = useState(false)

  // Columnas
  const [mapping, setMapping] = useState(null)
  const [amountMode, setAmountMode] = useState('single') // single | double
  const [dateFormat, setDateFormat] = useState('DMY')
  const [dateAmbiguous, setDateAmbiguous] = useState(false)
  const [negativeIsExpense, setNegativeIsExpense] = useState(false)
  const [rolePick, setRolePick] = useState(null) // índice de la columna cuyo uso se elige

  // Revisión
  const [existing, setExisting] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [overrides, setOverrides] = useState(() => new Map()) // id → categoría
  const [filter, setFilter] = useState('rev')
  const [groupBy, setGroupBy] = useState('month')
  const [query, setQuery] = useState('')
  const [picker, setPicker] = useState(null) // { ids, current }
  const [accepted, setAccepted] = useState(() => new Set()) // claves de recurrentes
  const [expanded, setExpanded] = useState(null)
  const [saving, setSaving] = useState(false)

  const built = useMemo(() => {
    if (!mapping || !table.length) return { rows: [], skipped: { income: 0, unpaid: 0 } }
    return buildImportRows(table, mapping, { dateFormat, negativeIsExpense, customCategories, existing, firstLine })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, mapping, dateFormat, negativeIsExpense, existing, firstLine, profile?.custom_categories])

  // Filas con la categoría que el usuario eligió y su estado recalculado.
  const rows = useMemo(() => built.rows.map(r => {
    const category = overrides.get(r.id) ?? r.category
    if (r.status === 'err') return r
    const reasons = r.reasons.filter(x => x !== 'uncategorized')
    if (!category) reasons.push('uncategorized')
    return { ...r, category, reasons, status: reasons.length ? 'rev' : 'ok' }
  }), [built.rows, overrides])

  const counts = useMemo(() => {
    const c = { ok: 0, rev: 0, err: 0 }
    rows.forEach(r => { c[r.status]++ })
    return c
  }, [rows])

  const chosen = useMemo(() => rows.filter(r => selected.has(r.id) && r.status !== 'err'), [rows, selected])
  const total = useMemo(() => chosen.reduce((s, r) => s + r.amount, 0), [chosen])

  // Lo que cae en el periodo de cobro en curso baja el disponible; lo anterior no.
  const period = useMemo(() => {
    if (!profile?.cobro_freq) return null
    const p = cobroPeriod(profile)
    return { start: dateToStr(p.start), end: dateToStr(p.end) }
  }, [profile])
  const inPeriod = useMemo(() => {
    if (!period) return { count: 0, sum: 0 }
    // Solo los que ya ocurrieron (hoy o antes) bajan el disponible: los de fecha futura entran como pendientes.
    const list = chosen.filter(r => r.date >= period.start && r.date <= period.end && r.date <= todayStr())
    return { count: list.length, sum: list.reduce((s, r) => s + r.amount, 0) }
  }, [chosen, period])
  const futureCount = useMemo(() => chosen.filter(r => r.date > todayStr()).length, [chosen])

  const suggestions = useMemo(() => (step === 'review' || step === 'recurring') ? detectRecurring(chosen) : [], [chosen, step])
  const repeatsByConcept = useMemo(() => {
    const m = new Map()
    suggestions.forEach(s => m.set(s.key, s))
    return m
  }, [suggestions])

  const visibleSteps = useMemo(() => ['file', ...(own ? [] : ['columns']), 'review', ...(suggestions.length ? ['recurring'] : [])], [own, suggestions.length])
  const stepNo = visibleSteps.indexOf(step) + 1

  // ── Paso 1: leer el archivo ──────────────────────────────────────────────
  async function handleFile(file) {
    if (!file) return
    setError(''); setLoading(true); setFileName(file.name)
    try {
      if (file.size > MAX_BYTES) { setError(t('importCsv.file.errorBig')); setLoading(false); return }
      const text = decodeCsvBuffer(await file.arrayBuffer())
      const delim = detectDelimiter(text)
      const all = parseCsv(text, delim)
      if (all.length < 2) { setError(t('importCsv.file.errorEmpty')); setLoading(false); return }
      const hIdx = detectHeaderRow(all)
      const hdrs = hIdx >= 0 ? all[hIdx] : all[0].map((_, i) => `${i + 1}`)
      const data = hIdx >= 0 ? all.slice(hIdx + 1) : all
      if (!data.length) { setError(t('importCsv.file.errorEmpty')); setLoading(false); return }
      if (data.length > MAX_ROWS) { setError(t('importCsv.file.errorBig')); setLoading(false); return }

      const isOwn = hIdx >= 0 && isOwnExport(hdrs)
      const guessed = guessMapping(hdrs)
      const saved = hIdx >= 0 ? readSavedMap(headerSignature(hdrs)) : null
      const map = saved?.mapping || guessed
      const dates = data.map(r => r[map.date]).filter(Boolean)
      const fmtInfo = isOwn ? { format: 'YMD', ambiguous: false } : detectDateFormat(dates.slice(0, 500))

      setTable(data); setHeaders(hdrs); setFirstLine(hIdx >= 0 ? hIdx + 2 : 1); setOwn(isOwn)
      setMapping(map)
      setAmountMode(map.debit >= 0 || map.credit >= 0 ? 'double' : 'single')
      setDateFormat(saved?.dateFormat || fmtInfo.format)
      setDateAmbiguous(!saved && fmtInfo.ambiguous)
      setNegativeIsExpense(isOwn ? false : (saved?.negativeIsExpense ?? guessNegativeIsExpense(data, map)))
      setLoading(false)
      if (isOwn) await goReview(data, map, 'YMD', false)
      else setStep('columns')
    } catch (e) {
      console.error('[Importar CSV] No se pudo leer el archivo:', e)
      setError(t('importCsv.file.errorRead')); setLoading(false)
    }
  }

  // ── Paso 2 → 3: traer lo que ya existe (duplicados) y armar la revisión ──
  async function goReview(dataArg = table, mapArg = mapping, fmtArg = dateFormat, negArg = negativeIsExpense) {
    setLoading(true)
    try {
      const probe = buildImportRows(dataArg, mapArg, { dateFormat: fmtArg, negativeIsExpense: negArg, customCategories, firstLine })
      const dates = probe.rows.map(r => r.date).filter(Boolean).sort()
      const ex = dates.length ? await onFetchExisting(dates[0], dates[dates.length - 1]) : []
      setExisting(ex)
      const finalRows = buildImportRows(dataArg, mapArg, { dateFormat: fmtArg, negativeIsExpense: negArg, customCategories, existing: ex, firstLine }).rows
      // Marcados de entrada: lo correcto y lo sin categoría; los posibles
      // duplicados quedan sin marcar (se pueden forzar).
      setSelected(new Set(finalRows.filter(r => r.status !== 'err' && !r.reasons.includes('duplicate')).map(r => r.id)))
      setOverrides(new Map())
      const firstFilter = finalRows.some(r => r.status === 'rev') ? 'rev' : finalRows.some(r => r.status === 'ok') ? 'ok' : 'err'
      setFilter(firstFilter)
      if (!own && headers.length) writeSavedMap(headerSignature(headers), { mapping: mapArg, dateFormat: fmtArg, negativeIsExpense: negArg })
      setStep('review')
    } finally {
      setLoading(false)
    }
  }

  // ── Revisión: filtros, grupos y selección ────────────────────────────────
  const shown = useMemo(() => {
    const q = strip(query)
    return rows.filter(r => r.status === filter && (!q || strip(r.concept).includes(q)))
  }, [rows, filter, query])

  const groups = useMemo(() => {
    if (groupBy === 'concept') {
      return groupByConcept(shown).map(g => ({
        key: g.key, label: g.label, rows: [...g.rows].sort((a, b) => (a.date < b.date ? 1 : -1)),
        repeat: repeatsByConcept.get(g.key) || null,
      }))
    }
    const months = getMonths()
    const m = new Map()
    for (const r of shown) {
      const k = r.date ? r.date.slice(0, 7) : '0000-00'
      if (!m.has(k)) m.set(k, { key: k, label: r.date ? `${months[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}` : '—', rows: [], repeat: null })
      m.get(k).rows.push(r)
    }
    return [...m.values()].sort((a, b) => (a.key < b.key ? 1 : -1)).map(g => ({ ...g, rows: g.rows.sort((a, b) => ((a.date || '') < (b.date || '') ? 1 : -1)) }))
  }, [shown, groupBy, repeatsByConcept])

  const items = useMemo(() => groups.flatMap(g => [{ k: 'h', id: `h-${g.key}`, g }, ...g.rows.map(r => ({ k: 'r', id: `r-${r.id}`, r }))]), [groups])

  const toggle = useCallback(id => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  }), [])

  function setMany(list, on) {
    setSelected(prev => {
      const n = new Set(prev)
      list.filter(r => r.status !== 'err').forEach(r => (on ? n.add(r.id) : n.delete(r.id)))
      return n
    })
  }
  const selectableShown = shown.filter(r => r.status !== 'err')
  const allShownOn = selectableShown.length > 0 && selectableShown.every(r => selected.has(r.id))

  function applyCategory(cat) {
    if (!picker) return
    setOverrides(prev => { const n = new Map(prev); picker.ids.forEach(id => n.set(id, cat)); return n })
    setPicker(null)
  }

  // ── Paso 4 y guardado ────────────────────────────────────────────────────
  const acceptedList = suggestions.filter(s => accepted.has(s.key))

  async function doImport() {
    if (saving || !chosen.length) return
    setSaving(true)
    const items = chosen.map(r => ({
      name: (r.concept || t('importCsv.review.noConcept')).slice(0, 80),
      amount: r.amount, category: r.category || 'Otros', date: r.date,
    }))
    const recurrents = acceptedList.map(s => ({
      name: (s.name || t('importCsv.review.noConcept')).slice(0, 80), amount: s.amount, category: s.category || 'Otros',
      freq: s.freq, isVariable: s.isVariable, nextDate: s.nextDate,
    }))
    const { error: err } = await onImport(items, recurrents)
    setSaving(false)
    if (err) { showToast(t('importCsv.toast.error')); return }
    showToast(recurrents.length
      ? t('importCsv.toast.successRecurring', { count: items.length, recurring: recurrents.length })
      : t('importCsv.toast.success', { count: items.length }))
    onClose()
  }

  function goNext() {
    if (suggestions.length) setStep('recurring')
    else doImport()
  }

  const stepper = mode === 'mobile' ? (
    <div className={styles.stpm}>
      <b>{t('importCsv.stepOf', { n: stepNo, total: visibleSteps.length })} · {t(`importCsv.steps.${step}`)}</b>
      <div className={styles.bars} style={{ gridTemplateColumns: `repeat(${visibleSteps.length}, 1fr)` }}>
        {visibleSteps.map((st, i) => <i key={st} className={i < stepNo ? styles.barOn : ''} />)}
      </div>
    </div>
  ) : (
    <ol className={styles.stp}>
      {visibleSteps.map((st, i) => (
        <li key={st} className={`${i + 1 === stepNo ? styles.stpOn : ''} ${i + 1 < stepNo ? styles.stpDone : ''}`} aria-current={i + 1 === stepNo ? 'step' : undefined}>
          {i + 1 < stepNo ? <Check size={14} strokeWidth={3} /> : <span>{i + 1}</span>}{t(`importCsv.steps.${st}`)}
        </li>
      ))}
    </ol>
  )

  // ── Paso 1 ───────────────────────────────────────────────────────────────
  function renderFile() {
    return (
      <>
        <section
          className={`${kit.panel} ${styles.drop} ${dragOver ? styles.dropOver : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]) }}
        >
          <span className={styles.dic}><FileSpreadsheet size={26} strokeWidth={1.8} /></span>
          <b>{t('importCsv.file.title')}</b>
          <span className={styles.dropSub}>{t('importCsv.file.subtitle')}</span>
          {loading
            ? <span className={styles.dropSub}><LoadingDots /> {t('importCsv.file.reading')}</span>
            : <button type="button" className={`${kit.btn} ${kit.btnLg} ${kit.btnPri}`} onClick={() => fileRef.current?.click()}>
                <Upload size={16} />{t('importCsv.file.pick')}
              </button>}
          {mode !== 'mobile' && !loading && <em className={styles.dropHint}>{t('importCsv.file.drop')}</em>}
          {fileName && !loading && !error && <em className={styles.dropHint}>{fileName}</em>}
          <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden
            onChange={e => { handleFile(e.target.files?.[0]); e.target.value = '' }} />
          {error && <div className={styles.errorText} role="alert">{error}</div>}
        </section>
        {sharedActive && <div className={kit.notice}><span>{t('importCsv.personalNote')}</span></div>}
      </>
    )
  }

  // Cada columna del archivo se asigna a UN uso; un uso solo puede tener una columna.
  function applyRole(role) {
    const i = rolePick
    if (i == null) return
    setMapping(m => {
      const next = { ...m }
      for (const k of ROLE_LIST) if (k !== 'none' && next[k] === i) next[k] = -1
      if (role !== 'none') next[role] = i
      if (role === 'amount') { next.debit = -1; next.credit = -1 }
      if (role === 'debit' || role === 'credit') next.amount = -1
      return next
    })
    if (role === 'amount') setAmountMode('single')
    if (role === 'debit' || role === 'credit') setAmountMode('double')
    setRolePick(null)
  }

  // ── Paso 2 ───────────────────────────────────────────────────────────────
  function renderColumns() {
    const roleOf = i => ROLE_LIST.find(k => k !== 'none' && mapping[k] === i) || 'none'
    const sample = i => {
      const vals = table.map(r => String(r[i] ?? '').trim()).filter(Boolean).slice(0, 3)
      return vals.length ? vals.join(', ') : t('importCsv.columns.emptyCol')
    }
    const amountOk = amountMode === 'single' ? mapping.amount >= 0 : (mapping.debit >= 0 || mapping.credit >= 0)
    const ready = mapping.date >= 0 && mapping.concept >= 0 && amountOk
    const rawDate = mapping.date >= 0 ? String((table.find(r => String(r[mapping.date] ?? '').trim()) || [])[mapping.date] ?? '').trim() : ''
    const fmtOpts = [['DMY', 'dmy'], ['MDY', 'mdy'], ['YMD', 'ymd']]
    const preview = table.slice(0, 3).map((r, i) => {
      const d = parseDate(r[mapping.date], dateFormat)
      return { i, d, c: String(r[mapping.concept] ?? ''), a: amountMode === 'single' ? r[mapping.amount] : (r[mapping.debit] || r[mapping.credit]) }
    })
    return (
      <div className={`${kit.grid} ${kit.gridWide}`}>
        <section className={kit.panel}>
          <div className={`${kit.notice} ${styles.okBox}`}>
            <Check size={18} style={{ color: 'var(--paid)' }} />
            <div className={styles.okText}><b>{t('importCsv.columns.okTitle')}</b><span>{t('importCsv.columns.okSub')}</span></div>
          </div>
          <div className={kit.pt}><b>{t('importCsv.columns.title')}</b><span>{t('importCsv.columns.subtitle')}</span></div>
          <div className={styles.cols}>
            {headers.map((h, i) => {
              const role = roleOf(i)
              return (
                <div key={i} className={styles.col}>
                  <div className={styles.colInfo}>
                    <small>{t('importCsv.columns.fileCol')}</small>
                    <b>{h || t('importCsv.columns.colFallback', { n: i + 1 })}</b>
                    <span>{t('importCsv.columns.example', { v: sample(i) })}</span>
                  </div>
                  <button type="button" className={`${styles.role} ${role === 'none' ? styles.roleOff : ''}`} onClick={() => setRolePick(i)}>
                    <span><small>{t('importCsv.columns.usedAs')}</small><b>{t(`importCsv.columns.roles.${role}`)}</b></span>
                    <ChevronDown size={16} />
                  </button>
                </div>
              )
            })}
          </div>
          <div className={kit.sep} />
          <div className={kit.pt}><b>{t('importCsv.columns.dateQ')}</b>{rawDate && <span>{t('importCsv.columns.dateSeen', { v: rawDate })}</span>}</div>
          <div className={styles.fmts} role="radiogroup" aria-label={t('importCsv.columns.dateQ')}>
            {fmtOpts.map(([v, k]) => {
              // parseDate acepta ISO con cualquier formato: aquí solo se "lee" si el texto tiene la forma de ese formato.
              const shapeOk = v === 'YMD' ? /^\d{4}[/.-]\d{1,2}[/.-]\d{1,2}/.test(rawDate) : /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(rawDate)
              const d = rawDate && shapeOk ? parseDate(rawDate, v) : null
              return (
                <button key={v} type="button" role="radio" aria-checked={dateFormat === v}
                  className={`${styles.fmt} ${dateFormat === v ? styles.fmtOn : ''}`}
                  onClick={() => { setDateFormat(v); setDateAmbiguous(false) }}>
                  <i aria-hidden="true" />
                  <span><b>{t(`importCsv.columns.fmt.${k}`)}</b><em>{rawDate ? (d ? t('importCsv.columns.dateReads', { v: rawDate, d: dateOf(d).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) }) : t('importCsv.columns.dateNo')) : ''}</em></span>
                </button>
              )
            })}
          </div>
          {dateAmbiguous && <div className={styles.warnText}>{t('importCsv.columns.dateAmbiguous')}</div>}
          <Collapse open={amountMode === 'single'}>
            <div {...switchProps(negativeIsExpense)} className={`${kit.row} ${kit.clickable} ${styles.negRow}`} onClick={() => setNegativeIsExpense(v => !v)}>
              <div className={kit.rowText}><b>{t('importCsv.columns.negative')}</b><span>{t('importCsv.columns.negativeHint')}</span></div>
              <Toggle on={negativeIsExpense} />
            </div>
          </Collapse>
        </section>
        <section className={kit.panel}>
          <div className={kit.pt}><b>{t('importCsv.columns.preview')}</b><span>{t('importCsv.columns.previewSub')}</span></div>
          {preview.map(p => (
            <div key={p.i} className={styles.prow}>
              <span className={p.d ? '' : styles.bad}>{p.d ? fmtShort(p.d) : t('importCsv.columns.previewBad')}</span>
              <b>{p.c}</b>
              <em>{p.a}</em>
            </div>
          ))}
          {!ready && <div className={styles.errorText}>{t('importCsv.columns.needFields')}</div>}
          <div className={`${kit.foot} ${kit.footEnd}`}>
            <button type="button" className={`${kit.btn} ${kit.btnLg} ${kit.btnPri}`} disabled={!ready || loading} onClick={() => goReview()}>
              {loading ? t('importCsv.file.reading') : t('importCsv.columns.continue')}
            </button>
          </div>
        </section>
      </div>
    )
  }

  // ── Paso 3 ───────────────────────────────────────────────────────────────
  function renderRow(item) {
    if (item.k === 'h') {
      const g = item.g
      const sel = g.rows.filter(r => r.status !== 'err')
      const on = sel.length > 0 && sel.every(r => selected.has(r.id))
      const sum = g.rows.reduce((acc, r) => acc + (r.status === 'err' ? 0 : r.amount), 0)
      return (
        <div key={item.id} className={styles.mhead} style={{ height: itemH }}>
          <div className={styles.mheadText}>
            <b>{g.label}{g.repeat && <span className={styles.repeatTag}><Repeat size={11} />{t(`importCsv.recurring.freq.${g.repeat.freq}`)}</span>}</b>
            <span>{t('importCsv.review.groupMeta', { count: g.rows.length, amount: fmt(sum) })}</span>
          </div>
          <div className={styles.groupActions}>
            {groupBy === 'concept' && filter !== 'err' && (
              <button type="button" className={styles.linkBtn} onClick={() => setPicker({ ids: g.rows.map(r => r.id), current: null, count: g.rows.length })}>
                {t('importCsv.review.changeCategory')}
              </button>
            )}
            {sel.length > 0 && (
              <button type="button" className={styles.linkBtn} onClick={() => setMany(g.rows, !on)}>
                {on ? t('importCsv.review.clearGroupShort') : t('importCsv.review.selectGroupShort')}
              </button>
            )}
          </div>
        </div>
      )
    }
    const r = item.r
    const on = selected.has(r.id)
    const err = r.status === 'err'
    const reason = r.reasons[0]
    return (
      <div key={item.id} className={styles.irow} style={{ height: itemH }}>
        <div
          className={`${styles.cbx} ${on ? styles.cbxOn : ''} ${err ? styles.cbxOff : ''}`}
          role="checkbox" aria-checked={on} aria-disabled={err} tabIndex={err ? -1 : 0}
          onClick={() => !err && toggle(r.id)}
          onKeyDown={e => { if (!err && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(r.id) } }}
        >{on && <Check size={14} strokeWidth={3} />}</div>
        <div className={styles.irowMain}>
          <b>{r.concept || t('importCsv.review.noConcept')}</b>
          <span>
            {err && reason ? <span className={styles.metaErr}>{t(`importCsv.review.reason.${reason}`)} · {t('importCsv.review.line', { n: r.line })}</span>
              : <>
                  {r.date ? fmtShort(r.date) : '—'}
                  {r.category && <> · {getCategoryLabel(r.category)}</>}
                  {reason && r.status === 'rev' && <> · <span className={styles.metaWarn}>{t(`importCsv.review.reason.${reason}`)}</span></>}
                </>}
          </span>
        </div>
        {!err && (
          <button type="button" className={styles.catBtn} aria-label={t('importCsv.review.categoryTitle')}
            onClick={() => setPicker({ ids: [r.id], current: r.category })}>
            {r.category ? <CategoryChip cat={r.category} profile={profile} customCategories={customCategories} /> : <span className={styles.catEmpty} />}
            <ChevronDown size={13} />
          </button>
        )}
        <em className={styles.irowAmt}>{err ? '' : fmt(r.amount)}</em>
      </div>
    )
  }

  const importLabel = saving ? t('importCsv.review.importing')
    : suggestions.length ? t('importCsv.columns.continue')
    : t('importCsv.review.import', { count: chosen.length })

  function renderReview() {
    const sum = key => (
      <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}
        className={`${styles.sm} ${filter === key ? styles.smOn : ''}`}>
        <b>{counts[key]}</b><span>{t(`importCsv.review.${key}`)}</span>
      </button>
    )
    const skipped = (built.skipped.income > 0 || built.skipped.unpaid > 0)
    const main = (
      <section className={`${kit.panel} ${styles.reviewMain}`}>
        <div className={styles.sums}>{['ok', 'rev', 'err'].map(sum)}</div>
        <div className={styles.tools}>
          <div className={styles.searchBox}>
            <Search size={15} />
            <input className={styles.searchInput} value={query} onChange={e => setQuery(e.target.value)} placeholder={t('importCsv.review.search')} aria-label={t('importCsv.review.search')} />
          </div>
          <SkSeg className={styles.groupSeg} value={groupBy} onChange={setGroupBy}
            options={[{ value: 'month', label: t('importCsv.review.byMonth') }, { value: 'concept', label: t('importCsv.review.byConcept') }]} />
        </div>
        {selectableShown.length > 0 && (
          <button type="button" className={`${styles.linkBtn} ${styles.bulk}`} onClick={() => setMany(shown, !allShownOn)}>
            {allShownOn ? t('importCsv.review.clearView') : t('importCsv.review.selectView', { count: selectableShown.length })}
          </button>
        )}
        {items.length === 0
          ? <div className={styles.emptyList}>{t('importCsv.review.empty')}</div>
          : <VirtualList items={items} itemH={itemH} renderItem={renderRow} resetKey={`${filter}|${groupBy}|${query}`} />}
        {mode === 'mobile' && skipped && (
          <div className={kit.sub2}>
            {[built.skipped.income > 0 && t('importCsv.review.skippedIncome', { count: built.skipped.income }), built.skipped.unpaid > 0 && t('importCsv.review.skippedUnpaid', { count: built.skipped.unpaid })].filter(Boolean).join(' · ')}
          </div>
        )}
      </section>
    )
    if (mode === 'mobile') {
      return (
        <>
          {main}
          {inPeriod.count > 0 && <div className={kit.notice}><span>{t('importCsv.review.periodWarn', { count: inPeriod.count, amount: fmt(inPeriod.sum) })}</span></div>}
          {futureCount > 0 && <div className={kit.notice}><span>{t('importCsv.review.futureNote', { count: futureCount })}</span></div>}
          <div className={styles.ifoot}>
            <span>{t('importCsv.review.selected', { count: chosen.length })} · {fmt(total)}</span>
            <button type="button" className={`${kit.btn} ${kit.btnLg} ${kit.btnPri}`} disabled={!chosen.length || saving} onClick={goNext}>{importLabel}</button>
          </div>
        </>
      )
    }
    return (
      <div className={`${kit.grid} ${styles.rv}`}>
        {main}
        <section className={`${kit.panel} ${styles.side}`}>
          <div className={kit.pt}><b>{t('importCsv.review.summary')}</b></div>
          <div className={styles.kv}><span>{t('importCsv.review.selected', { count: chosen.length })}</span><b>{fmt(total)}</b></div>
          {built.skipped.income > 0 && <div className={styles.kv}><span>{t('importCsv.review.skippedIncomeLabel')}</span><b>{built.skipped.income}</b></div>}
          {built.skipped.unpaid > 0 && <div className={styles.kv}><span>{t('importCsv.review.skippedUnpaidLabel')}</span><b>{built.skipped.unpaid}</b></div>}
          {inPeriod.count > 0 && <div className={styles.warn}>{t('importCsv.review.periodWarn', { count: inPeriod.count, amount: fmt(inPeriod.sum) })}</div>}
          {futureCount > 0 && <div className={styles.warn}>{t('importCsv.review.futureNote', { count: futureCount })}</div>}
          {counts.err > 0 && <div className={kit.sub2}>{t('importCsv.review.errNote')}</div>}
          <button type="button" className={`${kit.btn} ${kit.btnLg} ${kit.btnPri} ${kit.btnFull}`} disabled={!chosen.length || saving} onClick={goNext}>{importLabel}</button>
        </section>
      </div>
    )
  }

  // ── Paso 4 ───────────────────────────────────────────────────────────────
  function renderRecurring() {
    const n = acceptedList.length
    const flip = key => setAccepted(prev => { const nx = new Set(prev); nx.has(key) ? nx.delete(key) : nx.add(key); return nx })
    const cta = saving ? t('importCsv.review.importing') : n ? t('importCsv.recurring.cta', { count: n }) : t('importCsv.review.import', { count: chosen.length })
    return (
      <>
        <section className={kit.panel}>
          <div className={kit.pt}><b>{t('importCsv.recurring.title')}</b><span>{t('importCsv.recurring.subtitle')}</span></div>
          {suggestions.map(s => {
            const on = accepted.has(s.key)
            const open = expanded === s.key
            return (
              <div key={s.key} className={styles.rrowWrap}>
                <div className={styles.rrow}>
                  <button type="button" className={styles.rrowMain} aria-expanded={open} onClick={() => setExpanded(open ? null : s.key)}>
                    <CategoryChip cat={s.category || 'Otros'} profile={profile} customCategories={customCategories} big />
                    <span className={styles.rrowText}>
                      <b>{s.name}</b>
                      <span>{t(`importCsv.recurring.freq.${s.freq}`)} · {s.isVariable ? t('importCsv.recurring.variable') : t('importCsv.recurring.fixed')} · {t('importCsv.recurring.next', { date: fmtShort(s.nextDate) })}</span>
                    </span>
                    <em>{s.isVariable ? '≈' : ''}{fmt(s.amount)}</em>
                  </button>
                  <div {...switchProps(on)} aria-label={t('importCsv.recurring.toggle')} className={kit.clickable} onClick={() => flip(s.key)}><Toggle on={on} /></div>
                </div>
                <Collapse open={open}>
                  <div className={styles.detail}>
                    <span>{t('importCsv.recurring.detected', { count: s.count })}</span>
                    {s.ids.map(id => {
                      const r = rows.find(x => x.id === id)
                      return r ? <div key={id} className={styles.prow}><span>{fmtShort(r.date)}</span><b /><em>{fmt(r.amount)}</em></div> : null
                    })}
                  </div>
                </Collapse>
              </div>
            )
          })}
          {mode !== 'mobile' && (
            <div className={`${kit.foot} ${kit.footEnd}`}>
              <button type="button" className={`${kit.btn} ${kit.btnLg} ${kit.btnPri}`} disabled={saving || !chosen.length} onClick={doImport}>{cta}</button>
            </div>
          )}
        </section>
        {mode === 'mobile' && (
          <div className={styles.ifoot}>
            <span>{t('importCsv.review.selected', { count: chosen.length })} · {fmt(total)}</span>
            <button type="button" className={`${kit.btn} ${kit.btnLg} ${kit.btnPri}`} disabled={saving || !chosen.length} onClick={doImport}>{cta}</button>
          </div>
        )}
      </>
    )
  }

  function back() {
    if (step === 'recurring') setStep('review')
    else if (step === 'review') setStep(own ? 'file' : 'columns')
    else if (step === 'columns') setStep('file')
    else onBack?.()
  }

  const categoryOptions = [...CATEGORIES, ...customCategories.map(c => (typeof c === 'string' ? c : c?.value)).filter(Boolean)]

  const pickerSheet = (
    <BottomSheet
      open={!!picker}
      title={t('importCsv.review.categoryTitle')}
      onClose={() => setPicker(null)}
      header={picker && picker.ids.length > 1 ? <div className={styles.pickerSub}>{t('importCsv.review.categoryApply', { count: picker.ids.length })}</div> : null}
    >
      {categoryOptions.map(c => (
        <div key={c} className={`${styles.pickerRow} ${picker?.current === c ? styles.pickerRowOn : ''}`} role="button" tabIndex={0}
          data-selected={picker?.current === c ? 'true' : undefined}
          onClick={() => applyCategory(c)}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), applyCategory(c))}>
          <CategoryChip cat={c} profile={profile} customCategories={customCategories} />
          <span>{getCategoryLabel(c)}</span>
          {picker?.current === c && <Check size={16} />}
        </div>
      ))}
    </BottomSheet>
  )

  const roleNow = rolePick == null || !mapping ? null : (ROLE_LIST.find(k => k !== 'none' && mapping[k] === rolePick) || 'none')
  const roleSheet = (
    <BottomSheet
      open={rolePick != null}
      title={rolePick != null ? t('importCsv.columns.pickTitle', { col: headers[rolePick] || t('importCsv.columns.colFallback', { n: rolePick + 1 }) }) : ''}
      onClose={() => setRolePick(null)}
      header={rolePick != null ? <div className={styles.pickerSub}>{t('importCsv.columns.example', { v: table.map(r => String(r[rolePick] ?? '').trim()).filter(Boolean).slice(0, 3).join(', ') || t('importCsv.columns.emptyCol') })}</div> : null}
    >
      {ROLE_LIST.map(k => (
        <div key={k} className={`${styles.pickerRow} ${roleNow === k ? styles.pickerRowOn : ''}`} role="button" tabIndex={0}
          data-selected={roleNow === k ? 'true' : undefined}
          onClick={() => applyRole(k)}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), applyRole(k))}>
          <span className={styles.roleTxt}><b>{t(`importCsv.columns.roles.${k}`)}</b><em>{t(`importCsv.columns.roleHint.${k}`)}</em></span>
          {roleNow === k && <Check size={16} />}
        </div>
      ))}
    </BottomSheet>
  )

  // Subpágina en los tres tamaños (v0.9.978, mockup aprobado; antes era un
  // modal en móvil/tablet). «Atrás» regresa un paso; en el paso 1 sale.
  return (
    <SettingsSubLayout title={t('importCsv.title')} description={t('importCsv.desk.description')}
      icon={UploadSimple} onBack={back} slideClass={slideClass}
      actions={mode === 'desk' && step !== 'file' ? <button type="button" className={`${kit.btn} ${kit.btnSoft}`} onClick={back}><ChevronLeft size={16} />{t('buttons.back')}</button> : null}
      after={<>{pickerSheet}{roleSheet}</>}>
      {stepper}
      <div key={step} className={styles.stepBody}>
        {step === 'file' && renderFile()}
        {step === 'columns' && mapping && renderColumns()}
        {step === 'review' && renderReview()}
        {step === 'recurring' && renderRecurring()}
      </div>
    </SettingsSubLayout>
  )
}

// Subpágina «Importar datos». Al terminar de importar se remonta (key) para
// volver al paso 1 con todo limpio y se sale (móvil/tablet) con onBack.
export function ImportPage({ profile, sharedActive, onImport, onFetchExisting, onBack, slideClass }) {
  const [k, setK] = useState(0)
  return (
    <ImportBody key={k} profile={profile} sharedActive={sharedActive} onImport={onImport} onFetchExisting={onFetchExisting}
      onBack={onBack} slideClass={slideClass} onClose={() => { setK(n => n + 1); onBack?.() }} />
  )
}
