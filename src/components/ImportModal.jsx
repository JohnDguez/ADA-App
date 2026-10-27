import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Search, ChevronLeft, ChevronDown, Repeat, Check } from 'lucide-react'
import { Presence } from './Presence'
import { BottomSheet } from './BottomSheet'
import { Select } from './Select'
import { SegmentedControl } from './SegmentedControl'
import { useBackClose } from '../lib/backNav'
import { showToast } from './Toast'
import {
  decodeCsvBuffer, detectDelimiter, parseCsv, detectHeaderRow, guessMapping, isOwnExport,
  detectDateFormat, parseDate, buildImportRows, guessNegativeIsExpense, detectRecurring,
  groupByConcept, headerSignature, strip,
} from '../lib/importCsv'
import { CATEGORIES, getCategoryLabel, getCatColor, fmt, cobroPeriod, dateToStr, dateOf, getMonths, intlLocale } from '../lib/utils'
import { getCategoryIcon } from '../lib/categoryIcons'
import styles from './ImportModal.module.css'

// Importar desde un CSV (v0.9.802) — modal de hasta 4 pasos (Archivo ·
// Columnas · Revisión · Pagos que se repiten). Mockups aprobados con Johnatan.
// Móvil: hoja casi a pantalla completa. ≥768px: diálogo centrado de 2
// columnas, con el panel de resumen FIJO a la derecha (Regla 48) y la lista
// en formato fila (Regla 47). Las listas hacen scroll por dentro (.scroll-y):
// nunca hacen crecer el contenedor. Todo se procesa en el dispositivo.

const MAX_ROWS = 5000
const MAX_BYTES = 5 * 1024 * 1024
const MAP_KEY = 'lunapay_import_maps_v1'
const ITEM_H_PHONE = 60
const ITEM_H_TABLET = 48
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

function useIsTablet() {
  const [v, setV] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const on = e => setV(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return v
}

function fmtDate(str) {
  return dateOf(str).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' })
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

function CategoryChip({ cat, profile, customCategories }) {
  const color = getCatColor(cat, customCategories, profile?.category_colors)
  const Icon = getCategoryIcon(cat, profile?.category_icons)
  return (
    <span className={styles.catSquare} style={{ background: color }}>
      {Icon ? <Icon size={13} color="var(--on-color)" strokeWidth={2} /> : <span className={styles.catDot} />}
    </span>
  )
}

// ── Contenido (se monta dentro de <Presence>: su estado se reinicia al cerrar) ──
function ImportBody({ profile, sharedActive, onClose, onImport, onFetchExisting }) {
  const { t } = useTranslation()
  const isTablet = useIsTablet()
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
    const list = chosen.filter(r => r.date >= period.start && r.date <= period.end)
    return { count: list.length, sum: list.reduce((s, r) => s + r.amount, 0) }
  }, [chosen, period])

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

  // ── Render de cada paso ──────────────────────────────────────────────────
  function renderFile() {
    return (
      <div className={styles.bodyPad}>
        <div className={styles.stepTitle}>{t('importCsv.file.title')}</div>
        <div className={styles.stepSub}>{t('importCsv.file.subtitle')}</div>
        <div
          className={`${styles.drop} ${dragOver ? styles.dropOver : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]) }}
        >
          <FileSpreadsheet size={34} color="var(--accent)" strokeWidth={1.5} />
          {loading
            ? <div className={styles.dropText}>{t('importCsv.file.reading')}</div>
            : <>
                <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()}>
                  <Upload size={15} className={styles.btnIcon} />{t('importCsv.file.pick')}
                </button>
                <div className={styles.dropText}>{t('importCsv.file.drop')}</div>
              </>}
          {fileName && !loading && !error && <div className={styles.fileName}>{fileName}</div>}
          <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden
            onChange={e => { handleFile(e.target.files?.[0]); e.target.value = '' }} />
        </div>
        {error && <div className={styles.errorText} role="alert">{error}</div>}
        {sharedActive && <div className={styles.note}>{t('importCsv.personalNote')}</div>}
      </div>
    )
  }

  function renderColumns() {
    const opts = [{ value: '', label: t('importCsv.columns.none') }, ...headers.map((h, i) => ({ value: String(i), label: h || `#${i + 1}` }))]
    const set = key => v => setMapping(m => ({ ...m, [key]: v === '' ? -1 : Number(v) }))
    const val = key => (mapping[key] >= 0 ? String(mapping[key]) : '')
    const field = (key, label) => (
      <div className={styles.field}>
        <label className="field-label">{label}</label>
        <Select value={val(key)} onChange={set(key)} options={opts} placeholder={t('importCsv.columns.choose')} />
      </div>
    )
    const amountOk = amountMode === 'single' ? mapping.amount >= 0 : (mapping.debit >= 0 || mapping.credit >= 0)
    const ready = mapping.date >= 0 && mapping.concept >= 0 && amountOk
    const preview = table.slice(0, 3).map((r, i) => {
      const d = parseDate(r[mapping.date], dateFormat)
      return { i, d, c: String(r[mapping.concept] ?? ''), a: amountMode === 'single' ? r[mapping.amount] : (r[mapping.debit] || r[mapping.credit]) }
    })
    return (
      <>
        <div className={`scroll-y ${styles.bodyPad}`}>
          <div className={styles.stepTitle}>{t('importCsv.columns.title')}</div>
          <div className={styles.stepSub}>{t('importCsv.columns.subtitle')}</div>
          {field('date', t('importCsv.columns.date'))}
          {field('concept', t('importCsv.columns.concept'))}
          <div className={styles.field}>
            <SegmentedControl
              value={amountMode}
              onChange={v => {
                setAmountMode(v)
                setMapping(m => v === 'single' ? { ...m, debit: -1, credit: -1 } : { ...m, amount: -1 })
              }}
              options={[{ value: 'single', label: t('importCsv.columns.modeSingle') }, { value: 'double', label: t('importCsv.columns.modeDouble') }]}
            />
          </div>
          {amountMode === 'single'
            ? field('amount', t('importCsv.columns.amount'))
            : <>{field('debit', t('importCsv.columns.debit'))}{field('credit', t('importCsv.columns.credit'))}</>}
          {field('category', t('importCsv.columns.category'))}

          <div className={styles.field}>
            <label className="field-label">{t('importCsv.columns.dateFormat')}</label>
            <SegmentedControl
              value={dateFormat}
              onChange={v => { setDateFormat(v); setDateAmbiguous(false) }}
              options={[{ value: 'DMY', label: 'DD/MM/AAAA' }, { value: 'MDY', label: 'MM/DD/AAAA' }, { value: 'YMD', label: 'AAAA-MM-DD' }]}
            />
            {dateAmbiguous && <div className={styles.warnText}>{t('importCsv.columns.dateAmbiguous')}</div>}
          </div>

          {amountMode === 'single' && (
            <div className={styles.toggleRow} role="button" tabIndex={0}
              onClick={() => setNegativeIsExpense(v => !v)}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setNegativeIsExpense(v => !v))}>
              <div className={styles.toggleText}>
                <div className={styles.toggleLabel}>{t('importCsv.columns.negative')}</div>
                <div className={styles.toggleHint}>{t('importCsv.columns.negativeHint')}</div>
              </div>
              <div className={`toggle-track${negativeIsExpense ? ' is-on' : ''}`}><div className={`toggle-thumb${negativeIsExpense ? ' is-on' : ''}`} /></div>
            </div>
          )}

          <div className={styles.previewBox}>
            <div className="field-label">{t('importCsv.columns.preview')}</div>
            {preview.map(p => (
              <div key={p.i} className={styles.previewRow}>
                <span className={p.d ? styles.previewDate : styles.previewBad}>{p.d ? fmtDate(p.d) : t('importCsv.columns.previewBad')}</span>
                <span className={styles.previewConcept}>{p.c}</span>
                <span className={styles.previewAmount}>{p.a}</span>
              </div>
            ))}
          </div>
          {!ready && <div className={styles.errorText}>{t('importCsv.columns.needFields')}</div>}
        </div>
        <div className={styles.footer}>
          <button type="button" className="btn-primary" disabled={!ready || loading} onClick={() => goReview()}>
            {loading ? t('importCsv.file.reading') : t('importCsv.columns.continue')}
          </button>
        </div>
      </>
    )
  }

  function renderRow(item) {
    if (item.k === 'h') {
      const g = item.g
      const sel = g.rows.filter(r => r.status !== 'err')
      const on = sel.length > 0 && sel.every(r => selected.has(r.id))
      return (
        <div key={item.id} className={styles.groupHead} style={{ height: isTablet ? ITEM_H_TABLET : ITEM_H_PHONE }}>
          <div className={styles.groupTitle}>
            <span className={styles.groupLabel}>{g.label}</span>
            {g.repeat && <span className={styles.repeatTag}><Repeat size={11} />{t('importCsv.review.repeats', { freq: t(`importCsv.recurring.freq.${g.repeat.freq}`).toLowerCase() })}</span>}
            <span className={styles.groupCount}>{g.rows.length}</span>
          </div>
          <div className={styles.groupActions}>
            {groupBy === 'concept' && filter !== 'err' && (
              <button type="button" className={styles.linkBtn} onClick={() => setPicker({ ids: g.rows.map(r => r.id), current: null, count: g.rows.length })}>
                {t('importCsv.review.changeCategory')}
              </button>
            )}
            {sel.length > 0 && (
              <button type="button" className={styles.linkBtn} onClick={() => setMany(g.rows, !on)}>
                {on ? t('importCsv.review.clearGroup') : t('importCsv.review.selectGroup', { count: sel.length })}
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
      <div key={item.id} className={`${styles.row} ${on ? styles.rowOn : ''}`} style={{ height: isTablet ? ITEM_H_TABLET : ITEM_H_PHONE }}>
        <div
          className={`${styles.check} ${on ? styles.checkOn : ''} ${err ? styles.checkOff : ''}`}
          role="checkbox" aria-checked={on} aria-disabled={err} tabIndex={err ? -1 : 0}
          onClick={() => !err && toggle(r.id)}
          onKeyDown={e => { if (!err && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(r.id) } }}
        >{on && <Check size={13} color="var(--surface)" strokeWidth={3} />}</div>
        <div className={styles.rowMain}>
          <div className={styles.rowConcept}>{r.concept || t('importCsv.review.noConcept')}</div>
          <div className={styles.rowMeta}>
            {err && reason ? <span className={styles.metaErr}>{t(`importCsv.review.reason.${reason}`)} · {t('importCsv.review.line', { n: r.line })}</span>
              : <>
                  <span>{r.date ? fmtDate(r.date) : '—'}</span>
                  {reason && r.status === 'rev' && <span className={styles.metaWarn}>{t(`importCsv.review.reason.${reason}`)}</span>}
                </>}
          </div>
        </div>
        {!err && (
          <div
            className={styles.catBtn} role="button" tabIndex={0}
            onClick={() => setPicker({ ids: [r.id], current: r.category })}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setPicker({ ids: [r.id], current: r.category }))}
          >
            {r.category ? <CategoryChip cat={r.category} profile={profile} customCategories={customCategories} /> : <span className={styles.catEmpty} />}
            {isTablet && <span className={styles.catName}>{r.category ? getCategoryLabel(r.category) : t('importCsv.review.noCategory')}</span>}
            <ChevronDown size={13} color="var(--muted)" />
          </div>
        )}
        <div className={styles.rowAmount}>{err ? '' : fmt(r.amount)}</div>
      </div>
    )
  }

  function renderSummary(compact) {
    return (
      <div className={compact ? styles.footer : styles.sidePanel}>
        {!compact && <div className="field-label">{t('importCsv.review.summary')}</div>}
        {!compact && (
          <>
            <div className={styles.sideStat}><span>{t('importCsv.review.selected', { count: chosen.length })}</span></div>
            <div className={styles.sideTotal}>{fmt(total)}</div>
          </>
        )}
        {inPeriod.count > 0 && (
          <div className={styles.warnBox}>
            {t('importCsv.review.periodWarn', { count: inPeriod.count, amount: fmt(inPeriod.sum) })}
          </div>
        )}
        {!compact && (built.skipped.income > 0 || built.skipped.unpaid > 0 || counts.err > 0) && (
          <div className={styles.skipList}>
            {built.skipped.income > 0 && <div>{t('importCsv.review.skippedIncome', { count: built.skipped.income })}</div>}
            {built.skipped.unpaid > 0 && <div>{t('importCsv.review.skippedUnpaid', { count: built.skipped.unpaid })}</div>}
            {counts.err > 0 && <div>{t('importCsv.review.errNote')}</div>}
          </div>
        )}
        {compact && (
          <div className={styles.footerTotals}>
            <span>{t('importCsv.review.selected', { count: chosen.length })}</span>
            <span className={styles.footerAmount}>{fmt(total)}</span>
          </div>
        )}
        <button type="button" className="btn-primary" disabled={!chosen.length || saving}
          onClick={goNext}>
          {saving ? t('importCsv.review.importing')
            : suggestions.length ? t('importCsv.columns.continue')
            : t('importCsv.review.import', { count: chosen.length })}
        </button>
      </div>
    )
  }

  function renderReview() {
    const tile = (key, Icon, color) => (
      <div
        className={`${styles.tile} ${filter === key ? styles.tileOn : ''}`}
        role="button" tabIndex={0} aria-pressed={filter === key}
        onClick={() => setFilter(key)}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setFilter(key))}
      >
        <span className={styles.tileCount}>
          <Icon size={16} color={filter === key ? 'var(--surface)' : color} />
          {counts[key]}
        </span>
        <span className={styles.tileLabel}>{t(`importCsv.review.${key}`)}</span>
      </div>
    )
    return (
      <div className={styles.reviewWrap}>
        <div className={styles.reviewMain}>
          <div className={styles.tiles}>
            {tile('ok', CheckCircle2, 'var(--paid)')}
            {tile('rev', AlertTriangle, 'var(--warn-tone)')}
            {tile('err', XCircle, 'var(--danger)')}
          </div>
          <div className={styles.tools}>
            <div className={styles.searchBox}>
              <Search size={14} color="var(--muted)" />
              <input className={styles.searchInput} value={query} onChange={e => setQuery(e.target.value)} placeholder={t('importCsv.review.search')} aria-label={t('importCsv.review.search')} />
            </div>
            <div className={styles.segWrap}>
              <SegmentedControl value={groupBy} onChange={setGroupBy}
                options={[{ value: 'month', label: t('importCsv.review.byMonth') }, { value: 'concept', label: t('importCsv.review.byConcept') }]} />
            </div>
          </div>
          {selectableShown.length > 0 && (
            <div className={styles.bulkBar}>
              <button type="button" className={styles.linkBtn} onClick={() => setMany(shown, !allShownOn)}>
                {allShownOn ? t('importCsv.review.clearView') : t('importCsv.review.selectView', { count: selectableShown.length })}
              </button>
            </div>
          )}
          {items.length === 0
            ? <div className={styles.emptyList}>{t('importCsv.review.empty')}</div>
            : <VirtualList items={items} itemH={isTablet ? ITEM_H_TABLET : ITEM_H_PHONE} renderItem={renderRow} resetKey={`${filter}|${groupBy}|${query}`} />}
          {!isTablet && (built.skipped.income > 0 || built.skipped.unpaid > 0) && (
            <div className={styles.skipInline}>
              {[built.skipped.income > 0 && t('importCsv.review.skippedIncome', { count: built.skipped.income }), built.skipped.unpaid > 0 && t('importCsv.review.skippedUnpaid', { count: built.skipped.unpaid })].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        {isTablet ? renderSummary(false) : renderSummary(true)}
      </div>
    )
  }

  function renderRecurring() {
    const n = acceptedList.length
    return (
      <>
        <div className={`scroll-y ${styles.bodyPad}`}>
          <div className={styles.stepTitle}>{t('importCsv.recurring.title')}</div>
          <div className={styles.stepSub}>{t('importCsv.recurring.subtitle')}</div>
          {suggestions.map(s => {
            const on = accepted.has(s.key)
            const open = expanded === s.key
            return (
              <div key={s.key} className={styles.sugg}>
                <div className={styles.suggTop}>
                  <div className={styles.suggMain} role="button" tabIndex={0}
                    onClick={() => setExpanded(open ? null : s.key)}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setExpanded(open ? null : s.key))}>
                    <CategoryChip cat={s.category || 'Otros'} profile={profile} customCategories={customCategories} />
                    <div className={styles.suggText}>
                      <div className={styles.rowConcept}>{s.name}</div>
                      <div className={styles.rowMeta}>
                        {t(`importCsv.recurring.freq.${s.freq}`)} · {s.isVariable ? t('importCsv.recurring.variable') : t('importCsv.recurring.fixed')} · {fmt(s.amount)}
                      </div>
                    </div>
                    <ChevronDown size={15} color="var(--muted)" className={open ? styles.chevOpen : ''} />
                  </div>
                  <div
                    className={`toggle-track${on ? ' is-on' : ''}`} role="switch" aria-checked={on}
                    aria-label={t('importCsv.recurring.toggle')} tabIndex={0}
                    onClick={() => setAccepted(prev => { const nx = new Set(prev); nx.has(s.key) ? nx.delete(s.key) : nx.add(s.key); return nx })}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAccepted(prev => { const nx = new Set(prev); nx.has(s.key) ? nx.delete(s.key) : nx.add(s.key); return nx }) } }}
                  ><div className={`toggle-thumb${on ? ' is-on' : ''}`} /></div>
                </div>
                {open && (
                  <div className={styles.suggDetail}>
                    <div className={styles.rowMeta}>{t('importCsv.recurring.next', { date: fmtDate(s.nextDate) })} · {t('importCsv.recurring.detected', { count: s.count })}</div>
                    <div className={styles.detailList}>
                      {s.ids.map(id => {
                        const r = rows.find(x => x.id === id)
                        return r ? <div key={id} className={styles.previewRow}><span className={styles.previewDate}>{fmtDate(r.date)}</span><span className={styles.previewAmount}>{fmt(r.amount)}</span></div> : null
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className={styles.footer}>
          <div className={styles.footerTotals}>
            <span>{t('importCsv.review.selected', { count: chosen.length })}</span>
            <span className={styles.footerAmount}>{fmt(total)}</span>
          </div>
          <button type="button" className="btn-primary" disabled={saving || !chosen.length} onClick={doImport}>
            {saving ? t('importCsv.review.importing') : n ? t('importCsv.recurring.cta', { count: n }) : t('importCsv.review.import', { count: chosen.length })}
          </button>
        </div>
      </>
    )
  }

  function back() {
    if (step === 'recurring') setStep('review')
    else if (step === 'review') setStep(own ? 'file' : 'columns')
    else if (step === 'columns') setStep('file')
  }

  const categoryOptions = [...CATEGORIES, ...customCategories.map(c => (typeof c === 'string' ? c : c?.value)).filter(Boolean)]

  return (
    <>
      <div className={styles.head}>
        {step !== 'file'
          ? <button type="button" className={styles.iconBtn} onClick={back} aria-label={t('buttons.back')}><ChevronLeft size={20} color="var(--text)" /></button>
          : <span className={styles.iconSpacer} />}
        <div className={styles.headCenter}>
          <div className={styles.headTitle}>{t('importCsv.title')}</div>
          <div className={styles.headStep}>{t('importCsv.stepOf', { n: stepNo, total: visibleSteps.length })} · {t(`importCsv.steps.${step}`)}</div>
        </div>
        <button type="button" className={styles.iconBtn} onClick={onClose} aria-label={t('buttons.close')}><X size={20} color="var(--text)" /></button>
      </div>
      <div className={styles.dots} aria-hidden="true">
        {visibleSteps.map((s, i) => <span key={s} className={`${styles.dot} ${i < stepNo ? styles.dotOn : ''}`} />)}
      </div>
      <div className={styles.content}>
        {step === 'file' && renderFile()}
        {step === 'columns' && mapping && renderColumns()}
        {step === 'review' && renderReview()}
        {step === 'recurring' && renderRecurring()}
      </div>

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
          </div>
        ))}
      </BottomSheet>
    </>
  )
}

export function ImportModal({ open, onClose, profile, onImport, onFetchExisting, sharedActive = false }) {
  useBackClose(open, onClose)
  return (
    <Presence show={open}>
      {() => (
        <div className={styles.overlay} data-presence="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
          <div className={styles.panel} data-presence="panel" role="dialog" aria-modal="true">
            <ImportBody
              profile={profile} sharedActive={sharedActive}
              onClose={onClose} onImport={onImport} onFetchExisting={onFetchExisting}
            />
          </div>
        </div>
      )}
    </Presence>
  )
}
