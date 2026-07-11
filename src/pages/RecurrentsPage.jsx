import { useState, useMemo } from 'react'
import { Pause, Play, Trash2, Search, ChevronDown, CreditCard, Pencil, MoreVertical } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { NewSharedSpacePanel } from '../components/NewSharedSpacePanel'
import { fmt, RECUR_FREQ, dateOf, MONTHS_SHORT } from '../lib/utils'

const CAT_COLOR = {
  'Servicios':     'var(--cat-servicios)',
  'Suscripciones': 'var(--cat-suscripciones)',
  'Créditos':      'var(--cat-creditos)',
  'Renta':         'var(--cat-renta)',
  'Seguros':       'var(--cat-seguros)',
  'Alimentación':  'var(--cat-alimentacion)',
  'Transporte':    'var(--cat-transporte)',
  'Medicina':      'var(--cat-medicina)',
  'Doctor':        'var(--cat-doctor)',
  'Mantenimiento': 'var(--cat-mantenimiento)',
  'Otros':         'var(--cat-otros)',
}

function FilterChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: '6px 14px', borderRadius: 5, border: 'none', background: active ? 'var(--accent)' : 'var(--surface)', color: active ? 'var(--surface)' : 'var(--text)', fontWeight: active ? 600 : 400, fontSize: 12, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', transition: 'background .15s, color .15s' }}>
      {label}
    </button>
  )
}

export function RecurrentsPage({ payments, profile, spaceSwitcher, activeSpaceId = null, sharedSpaces, onOpenPremium, onSpaceReady, unreadCount, onOpenNotifs, onGoSettings, onPause, onResume, onDelete, onEdit, slideClass }) {
  const [search,        setSearch]        = useState('')
  const [filterStatus,  setFilterStatus]  = useState('todos')
  const [filterType,    setFilterType]    = useState('todos')
  const [expandedCats,  setExpandedCats]  = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [openMenu,      setOpenMenu]      = useState(null)

  // Masters: registros raíz de cada pago recurrente
  const masters = useMemo(() =>
    payments.filter(p => p.is_master)
  , [payments])

  // Copias pendientes del siguiente periodo (sin master)
  function getNextDue(masterId) {
    return payments
      .filter(p => p.parent_id === masterId && !p.is_paid && !p.is_master)
      .sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))[0] || null
  }

  function getPaidCount(masterId) {
    return payments.filter(p => p.parent_id === masterId && p.is_paid).length
  }

  // Métricas
  const activeMasters = masters.filter(m => !m.paused)
  const pausedMasters = masters.filter(m => m.paused)
  const totalMensual  = activeMasters
    .filter(m => !m.is_variable && m.recur_freq === 'monthly')
    .reduce((s, m) => s + Number(m.amount), 0)

  // Filtros
  const filtered = useMemo(() => {
    return masters.filter(m => {
      if (filterStatus === 'activos'  &&  m.paused) return false
      if (filterStatus === 'pausados' && !m.paused) return false
      // Filtro defensivo: is_installment puede ser null en registros viejos
      const isInstallment = m.is_installment || (m.total_installments > 0)
      if (filterType === 'recurrentes'   &&  isInstallment) return false
      if (filterType === 'parcialidades' && !isInstallment) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!m.name.toLowerCase().includes(q) && !m.category?.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [masters, filterStatus, filterType, search])

  // Agrupar por categoría
  const byCategory = useMemo(() => {
    const map = {}
    filtered.forEach(m => {
      const cat = m.category || 'Otros'
      if (!map[cat]) map[cat] = []
      map[cat].push(m)
    })
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length)
  }, [filtered])


  function formatNextDate(due_date) {
    if (!due_date) return null
    const d = dateOf(due_date)
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
  }

  return (
    <div style={{ paddingBottom: 120, background: 'var(--bg)', minHeight: '100vh' }} onClick={() => setOpenMenu(null)}>
      <PageHeader profile={profile} unreadCount={unreadCount} onOpenNotifs={onOpenNotifs} onGoSettings={onGoSettings} />

      {/* Menú contextual flotante */}
      {openMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: openMenu.top,
            right: openMenu.right,
            zIndex: 999,
            background: 'var(--menu-bg)',
            border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            minWidth: 180,
            overflow: 'hidden',
          }}
        >
          {(() => {
            const master = masters.find(m => m.id === openMenu.id)
            if (!master) return null
            return (
              <>
                <MenuItem icon={<Pencil size={14} />} label="Editar" onClick={() => { onEdit && onEdit(master); setOpenMenu(null) }} />
                <MenuItem icon={<Trash2 size={14} />} label="Eliminar" onClick={() => { setConfirmDelete(master.id); setOpenMenu(null) }} danger />
              </>
            )
          })()}
        </div>
      )}

      <div style={{ background: 'var(--bg)', borderRadius: '24px 24px 0 0', marginTop: -24, position: 'relative', zIndex: 10 }}>
        <div className={slideClass}>

          {spaceSwitcher && <div style={{ padding: '16px 16px 0' }}>{spaceSwitcher}</div>}

          {activeSpaceId === 'new' ? (
            <div style={{ marginTop: 16 }}>
              <NewSharedSpacePanel
                profile={profile}
                sharedSpaces={sharedSpaces}
                onOpenPremium={onOpenPremium}
                onCreated={onSpaceReady}
                onJoined={onSpaceReady}
              />
            </div>
          ) : (
          <>
          {/* Zona título */}
          <div style={{ padding: '16px 16px 18px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Gastos recurrentes</div>
            <div style={{ fontSize: 13, fontWeight: 400, color: 'var(--text)', marginTop: 4 }}>Gestiona tus pagos fijos y variables.</div>
          </div>


          {/* Buscador */}
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 12, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                <Search size={15} color="var(--text)" />
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o categoría..." className="field-input" style={{ paddingLeft: 36 }} />
            </div>
          </div>

          {/* Resumen */}
          <div data-coachmark="recurrentes-stats" style={{ margin: '0 16px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 16px', display: 'flex' }}>
            <div style={{ flex: 1, borderRight: '0.5px solid var(--border)', paddingRight: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Activos</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{activeMasters.length}</div>
              <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 2 }}>{pausedMasters.length} pausados</div>
            </div>
            <div style={{ flex: 1, paddingLeft: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Suma mensual</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{fmt(totalMensual)}</div>
              <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 2 }}>pagos mensuales</div>
            </div>
          </div>

          {/* Filtros */}
          <div style={{ padding: '0 16px 6px', display: 'flex', gap: 6 }}>
            {[['todos','Todos'],['activos','Activos'],['pausados','Pausados']].map(([val, label]) => (
              <FilterChip key={val} label={label} active={filterStatus === val} onClick={() => setFilterStatus(val)} />
            ))}
          </div>
          <div data-coachmark="recurrentes-filtro-tipo" style={{ padding: '0 16px 14px', display: 'flex', gap: 6 }}>
            {[['todos','Todos'],['recurrentes','Recurrentes'],['parcialidades','Parcialidades']].map(([val, label]) => (
              <FilterChip key={val} label={label} active={filterType === val} onClick={() => setFilterType(val)} />
            ))}
          </div>

          {/* Lista por categoría */}
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {byCategory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <CreditCard size={32} color="var(--border)" style={{ marginBottom: 10 }} />
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                  {search ? 'Sin resultados para tu búsqueda' : 'Sin gastos recurrentes registrados'}
                </div>
              </div>
            ) : byCategory.map(([cat, catMasters]) => {
              const isOpen   = !!expandedCats[cat]
              const catTotal = catMasters.filter(m => !m.is_variable && !m.paused).reduce((s, m) => s + Number(m.amount), 0)

              return (
                <div key={cat} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                  {/* Header categoría */}
                  <div
                    onClick={() => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }))}
                    style={{ display: 'flex', alignItems: 'center', padding: '14px', cursor: 'pointer', borderBottom: isOpen ? '0.5px solid var(--border)' : 'none', minHeight: 58 }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: CAT_COLOR[cat] || 'var(--accent)', flexShrink: 0, marginRight: 10 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{cat}</div>
                      <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 1 }}>
                        {catMasters.length} pago{catMasters.length !== 1 ? 's' : ''}
                        {catTotal > 0 && ` · ${fmt(catTotal)}/mes`}
                      </div>
                    </div>
                    <div style={{ transition: 'transform .25s ease', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      <ChevronDown size={18} color="var(--text)" />
                    </div>
                  </div>

                  {/* Items */}
                  <div style={{ maxHeight: isOpen ? '2000px' : '0px', overflow: 'hidden', transition: 'max-height .3s ease' }}>
                    {catMasters.map((master, idx) => {
                      const isLast       = idx === catMasters.length - 1
                      const next         = getNextDue(master.id)
                      const paid         = getPaidCount(master.id)
                      const isConfirming = confirmDelete === master.id

                      return (
                        <div key={master.id}>
                          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: isLast && !isConfirming ? 'none' : '0.5px solid var(--border)', gap: 8 }}>
                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {master.name}
                                {master.is_variable && (
                                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'var(--label-variable)', color: '#fff' }}>Variable</span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 2 }}>
                                {RECUR_FREQ[master.recur_freq] || master.recur_freq}
                                {!(master.is_installment || master.total_installments > 0) && paid > 0 && ` · ${paid} realizado${paid !== 1 ? 's' : ''}`}
                              </div>
                              {!master.paused && next && !(master.is_installment || master.total_installments > 0) && (
                                <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500, marginTop: 2 }}>
                                  Próximo: {formatNextDate(next.due_date)}
                                </div>
                              )}
                              {!master.paused && next && (master.is_installment || master.total_installments > 0) && (
                                <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500, marginTop: 2 }}>
                                  Pago {next.current_installment} de {master.total_installments}
                                </div>
                              )}
                              {master.paused && (
                                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginTop: 2 }}>Pausado</div>
                              )}
                            </div>

                            {/* Monto */}
                            {!master.is_variable && (
                              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>
                                {fmt(master.amount)}
                              </div>
                            )}

                            {/* Botones */}
                            <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center' }}>
                              <ActionBtn
                                onClick={() => master.paused ? onResume(master.id) : onPause(master.id)}
                                color={master.paused ? 'var(--paid)' : 'var(--warning)'}
                              >
                                {master.paused
                                  ? <Play size={13} color="#fff" />
                                  : <Pause size={13} color="#fff" />
                                }
                              </ActionBtn>
                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  setOpenMenu(openMenu?.id === master.id ? null : { id: master.id, top: rect.bottom + 4, right: window.innerWidth - rect.right })
                                }}
                                style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                              >
                                <MoreVertical size={16} color="var(--text)" />
                              </button>
                            </div>
                          </div>

                          {/* Confirmación borrado */}
                          {isConfirming && (
                            <div style={{ padding: '10px 14px', background: 'var(--danger-soft)', borderBottom: isLast ? 'none' : '0.5px solid var(--border)' }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', marginBottom: 8 }}>
                                ¿Eliminar "{master.name}"? Los pagos ya realizados se conservarán.
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '7px', borderRadius: 6, border: '0.5px solid var(--border)', background: 'var(--surface)', fontSize: 12, fontWeight: 600, color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                                  Cancelar
                                </button>
                                <button onClick={() => { onDelete && onDelete(master.id, master); setConfirmDelete(null) }} style={{ flex: 1, padding: '7px', borderRadius: 6, border: 'none', background: 'var(--danger)', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                                  Eliminar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

          </div>

          </>
          )}

        </div>
      </div>
    </div>
  )
}

function ActionBtn({ onClick, color, children }) {
  return (
    <button onClick={onClick} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
      {children}
    </button>
  )
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--bg)', fontSize: 13, fontWeight: 500, color: danger ? 'var(--danger)' : 'var(--text)', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', textAlign: 'left' }}>
      <span style={{ color: danger ? 'var(--danger)' : 'var(--text)' }}>{icon}</span>{label}
    </button>
  )
}
