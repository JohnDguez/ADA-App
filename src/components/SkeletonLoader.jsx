// ── SkeletonLoader ────────────────────────────────────────────────────────────
// Esqueleto del arranque (mientras authLoading || profileLoading en App.jsx) y
// piezas de carga por sección. Rediseñado en v0.9.1038 para reflejar el
// diseño actual en móvil, tablet vertical, tablet horizontal y escritorio
// (mockup aprobado por Johnatan).
//
// Reglas del esqueleto:
//  · Solo grises derivados de los tokens del tema (--sk, --sk-hi, --sk-strong
//    en index.css), claro y oscuro; nunca azul, dorado ni verde.
//  · El chrome fijo (riel, barra inferior, botones del encabezado) va quieto
//    (`fixed`); solo los datos animan con shimmer.
//  · El shimmer se detiene con prefers-reduced-motion (index.css).
//
// Los cuatro marcos se renderizan a la vez y el CSS muestra solo el que
// corresponde al ancho (mismos cortes que el Inicio real: 768 / 960 / 1100),
// así no hay parpadeo ni dependencia de JS mientras carga la sesión.
import styles from './SkeletonLoader.module.css'

// `Bone` se exporta para que cualquier pantalla pida el mismo hueso durante
// `dataLoading` en vez de inventar el suyo. `fixed`: hueso de chrome, sin brillo.
export function Bone({ w, h, r, fixed, style }) {
  return (
    <div
      className={fixed ? 'skeleton-bone-fixed' : 'skeleton-bone'}
      style={{ width: w, height: h, borderRadius: r ?? 6, flexShrink: 0, ...style }}
    />
  )
}

const Col = ({ gap = 0, className = '', style, children }) => (
  <div className={`${styles.col} ${className}`} style={{ gap, ...style }}>{children}</div>
)
const Row = ({ gap = 0, className = '', style, children }) => (
  <div className={`${styles.rw} ${className}`} style={{ gap, ...style }}>{children}</div>
)

// Puntos del selector de periodo (activo alargado + 2).
const Dots = () => (
  <Row gap={5}><Bone w={22} h={6} r={3} /><Bone w={6} h={6} r={3} /><Bone w={6} h={6} r={3} /></Row>
)

// Selector de periodo: flecha, etiqueta con puntos, flecha.
const Selector = ({ labelW = 110, style }) => (
  <Row className={styles.sp} style={style}>
    <Bone w={36} h={36} r="50%" />
    <Col gap={10} className={styles.ctr}><Bone w={labelW} h={15} r={5} /><Dots /></Col>
    <Bone w={36} h={36} r="50%" />
  </Row>
)

// Medio anillo del medidor (aro gris + tramo con brillo) con total al centro.
function Gauge({ w, h, children, gap = 8, bottom = 8 }) {
  return (
    <div className={styles.gaugeBox}>
      <svg width={w} height={h} viewBox="0 -4 300 172" aria-hidden="true" className={styles.gauge}>
        <path className={styles.gt} d="M20,140 A130,130 0 0 1 280,140" />
        <path className={styles.gf} d="M20,140 A130,130 0 0 1 140,10" />
      </svg>
      <Col gap={gap} className={`${styles.ctr} ${styles.gaugeCenter}`} style={{ bottom }}>{children}</Col>
    </div>
  )
}

// Fila de pago: ficha de fecha, nombre + apoyo, monto y botón de menú.
function PayRow({ big }) {
  const s = big ? 48 : 44
  return (
    <Row gap={14} style={{ padding: big ? '12px 0' : '10px 0' }}>
      <Bone w={s} h={s + 6} r={16} />
      <Col gap={9} style={{ flex: 1 }}><Bone w="42%" h={14} r={5} /><Bone w="22%" h={11} r={5} /></Col>
      <Bone w={big ? 70 : 60} h={15} r={5} />
      <Bone w={big ? 40 : 36} h={big ? 40 : 36} r="50%" />
    </Row>
  )
}

// Consejo (tarjeta gris con avatar, 3 líneas y acciones).
const Tip = () => (
  <div className={`${styles.chip} ${styles.rw} sk-onchip`} style={{ gap: 14, padding: 16 }}>
    <Bone w={38} h={38} r="50%" />
    <Col gap={9} style={{ flex: 1 }}><Bone w={170} h={13} r={5} /><Bone w="80%" h={10} r={5} /><Bone w={110} h={10} r={5} /></Col>
    <Bone w={36} h={12} r={5} />
    <Bone w={34} h={34} r="50%" />
  </div>
)

// Luna con su globo de mensaje.
const LunaBubble = ({ ls, bw = '100%', bh, style }) => (
  <Row gap={10} style={style}>
    <Bone w={ls} h={ls} r="32%" />
    <Bone w={bw} h={bh} r={20} style={{ flex: 1 }} />
  </Row>
)

const Bars = ({ heights, w, scale = 1, gap = 12 }) => (
  <Row gap={gap} style={{ alignItems: 'flex-end' }}>
    {heights.map((hh, i) => <Bone key={i} w={w} h={Math.round(hh * scale)} r={8} />)}
  </Row>
)
const BAR_H = [44, 66, 32, 80, 52, 38, 70]

// Riel flotante de 72px de tablet (chrome fijo).
function Rail() {
  const ico = (k) => <div key={k} style={{ marginBottom: 26 }}><Bone fixed w={24} h={24} r={8} /></div>
  return (
    <div className={styles.rail}>
      <Bone fixed w={44} h={44} r={14} />
      <div style={{ height: 12 }} />
      <Bone fixed w={32} h={32} r="50%" />
      <div style={{ height: 30 }} />
      {[0, 1, 2, 3].map(ico)}
      <div className={styles.railSep} />
      {[4, 5].map(ico)}
      <Col className={styles.ctr} style={{ marginTop: 'auto' }}>
        {[6, 7].map(ico)}
        <Bone fixed w={44} h={44} r="50%" />
      </Col>
    </div>
  )
}

// ── Móvil (<768) ──
function MobileFrame() {
  return (
    <div className={`${styles.frame} ${styles.fMobile}`}>
      <Col gap={14} style={{ padding: '18px 16px 0' }}>
        <Row className={styles.sp} style={{ alignItems: 'flex-start' }}>
          <Col gap={9} style={{ paddingTop: 4 }}>
            <Bone w={120} h={11} r={4} />
            <Bone w={176} h={22} r={6} />
            <Bone w={124} h={22} r={6} />
            <Bone w={112} h={28} r={14} style={{ marginTop: 4 }} />
          </Col>
          <Row gap={8}><Bone fixed w={46} h={46} r="50%" /><Bone fixed w={52} h={52} r="50%" /></Row>
        </Row>
        <LunaBubble ls={100} bh={58} style={{ gap: 12 }} />
        <Selector style={{ width: '100%' }} />
        <div className={`${styles.card} ${styles.col}`} style={{ padding: '18px 18px 16px' }}>
          <Row className={styles.sp} style={{ alignItems: 'flex-start' }}>
            <Col gap={10}><Bone w={86} h={13} r={5} /><Bone w={172} h={38} r={8} /><Bone w={190} h={11} r={5} /></Col>
            <Bone fixed w={34} h={34} r="50%" />
          </Row>
          <div style={{ alignSelf: 'center', marginTop: 14 }}>
            <Gauge w={250} h={138} bottom={6}><Bone w={78} h={30} r={8} /><Bone w={38} h={10} r={4} /></Gauge>
          </div>
          <Row gap={10} style={{ marginTop: 10 }}>
            {[0, 1].map(i => (
              <Col key={i} gap={9} className={`${styles.chip} sk-onchip`} style={{ flex: 1, padding: 14 }}>
                <Bone w={54} h={10} r={4} /><Bone w={70} h={20} r={6} />
              </Col>
            ))}
          </Row>
          <Row gap={10} className={`${styles.chip} sk-onchip`} style={{ padding: '0 16px', height: 40, marginTop: 10 }}>
            <Bone w={10} h={10} r="50%" /><Bone w={84} h={11} r={4} />
          </Row>
        </div>
        <Row gap={8} style={{ marginTop: 2 }}><Bone w={124} h={13} r={5} /><Bone w={22} h={18} r={9} /></Row>
      </Col>
      <div className={styles.navb}>
        <Bone fixed w={92} h={46} r={23} style={{ background: 'var(--desk-chip)' }} />
        {[0, 1, 2, 3].map(i => <Bone key={i} fixed w={24} h={24} r={8} />)}
      </div>
    </div>
  )
}

// ── Tablet vertical (768–959) ──
function TabletVFrame() {
  return (
    <div className={`${styles.frame} ${styles.fTabV}`}>
      <Rail />
      <Col gap={14} className={styles.tabContentV}>
        <Row className={styles.sp} style={{ height: 150, padding: '34px 8px 0', alignItems: 'flex-start' }}>
          <Col gap={12}><Bone w={188} h={11} r={4} /><Bone w={300} h={34} r={8} /><Bone w={140} h={34} r={8} /></Col>
          <Row style={{ alignItems: 'flex-start' }}>
            <Bone w={150} h={78} r={20} />
            <div style={{ marginLeft: -6, marginTop: 20 }}><Bone w={96} h={96} r="32%" /></div>
          </Row>
        </Row>
        <Row className={`${styles.sp} ${styles.strong} sk-onstrong`} style={{ height: 106, padding: '0 24px' }}>
          <Col gap={12}><Bone w={90} h={12} r={4} /><Bone w={188} h={38} r={8} /></Col>
          <Row gap={16}>
            <Col gap={10} style={{ alignItems: 'flex-end' }}><Bone w={130} h={12} r={4} /><Bone w={100} h={12} r={4} /></Col>
            <Bone fixed w={40} h={40} r="50%" />
          </Row>
        </Row>
        <Row gap={14} style={{ alignItems: 'stretch' }}>
          <div className={`${styles.card} ${styles.col}`} style={{ flex: 1.15, padding: 20, height: 328 }}>
            <Bone w={130} h={18} r={6} />
            <div style={{ margin: 'auto' }}>
              <Gauge w={300} h={165} bottom={12}><Bone w={84} h={32} r={8} /><Bone w={40} h={10} r={4} /></Gauge>
            </div>
            <Row gap={18} className={styles.jc} style={{ marginTop: 16 }}>
              {[0, 1, 2].map(i => <Bone key={i} w={66} h={11} r={4} />)}
            </Row>
          </div>
          <Col gap={14} style={{ flex: 1 }}>
            {[0, 1, 2].map(i => (
              <Col key={i} gap={10} className={styles.card} style={{ padding: '18px 20px', flex: 1 }}>
                <Bone w={54} h={12} r={4} /><Bone w={124} h={26} r={7} /><Bone w={112} h={10} r={4} />
              </Col>
            ))}
          </Col>
        </Row>
        <div className={`${styles.card} ${styles.col}`} style={{ padding: '20px 22px' }}>
          <Row className={styles.sp}>
            <Bone w={110} h={20} r={6} />
            <Row gap={28}><Bone w={34} h={34} r="50%" /><Col gap={10} className={styles.ctr}><Bone w={100} h={14} r={5} /><Dots /></Col><Bone w={34} h={34} r="50%" /></Row>
          </Row>
          <Row gap={8} style={{ margin: '22px 0 4px' }}><Bone w={48} h={12} r={4} /><Bone w={22} h={18} r={9} /></Row>
          <PayRow big /><div className={styles.hair} /><PayRow big />
          <div style={{ marginTop: 16 }}><Tip /></div>
        </div>
      </Col>
    </div>
  )
}

// ── Tablet horizontal (960–1099) ──
function TabletHFrame() {
  const Tile = ({ strong }) => (
    <Col gap={10} className={strong ? `${styles.strong} sk-onstrong` : styles.card}
      style={{ flex: 1, padding: '16px 18px', height: 112, justifyContent: 'space-between' }}>
      <Bone w={70} h={13} r={4} /><Bone w={strong ? 120 : 110} h={30} r={8} /><Bone w={strong ? 140 : 104} h={10} r={4} />
    </Col>
  )
  return (
    <div className={`${styles.frame} ${styles.fTabH}`}>
      <Rail />
      <Col gap={14} className={styles.tabContentH}>
        <Row className={styles.sp} style={{ height: 112, padding: '34px 12px 0', alignItems: 'flex-start' }}>
          <Col gap={12}><Bone w={188} h={11} r={4} /><Bone w={380} h={34} r={8} /></Col>
          <Row style={{ alignItems: 'flex-start' }}>
            <Bone w={160} h={44} r={18} />
            <div style={{ marginLeft: -6, marginTop: -4 }}><Bone w={76} h={76} r="32%" /></div>
          </Row>
        </Row>
        <Row gap={12} style={{ marginTop: -6 }}><Tile strong /><Tile /><Tile /><Tile /></Row>
        <Row gap={14} style={{ alignItems: 'flex-start' }}>
          <div className={`${styles.card} ${styles.col}`} style={{ flex: 1.35, padding: '20px 22px', height: 482 }}>
            <Row className={styles.sp}>
              <Bone w={110} h={20} r={6} />
              <Row gap={22}><Bone w={34} h={34} r="50%" /><Col gap={10} className={styles.ctr}><Bone w={100} h={14} r={5} /><Dots /></Col><Bone w={34} h={34} r="50%" /></Row>
            </Row>
            <Row gap={8} style={{ margin: '22px 0 4px' }}><Bone w={48} h={12} r={4} /><Bone w={22} h={18} r={9} /></Row>
            <PayRow big /><div className={styles.hair} /><PayRow big />
            <div style={{ marginTop: 'auto' }}><Tip /></div>
          </div>
          <Col gap={14} style={{ flex: 1 }}>
            <div className={`${styles.card} ${styles.col}`} style={{ padding: '18px 20px', height: 240 }}>
              <Bone w={130} h={18} r={6} />
              <div style={{ margin: 'auto' }}>
                <Gauge w={230} h={126} gap={7}><Bone w={64} h={26} r={7} /><Bone w={34} h={10} r={4} /></Gauge>
              </div>
              <Row gap={14} className={styles.jc} style={{ marginTop: 10 }}>{[0, 1, 2].map(i => <Bone key={i} w={54} h={10} r={4} />)}</Row>
            </div>
            <Col gap={10} className={styles.card} style={{ padding: '18px 20px', height: 228 }}>
              <Bone w={110} h={16} r={6} /><Bone w={130} h={11} r={4} /><Bone w={110} h={26} r={7} /><Bone w={100} h={10} r={4} />
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', marginTop: 4 }}><Bars heights={BAR_H} w={30} /></div>
            </Col>
          </Col>
        </Row>
      </Col>
    </div>
  )
}

// ── Escritorio (≥1100) ──
function DesktopFrame() {
  const Tile = ({ strong }) => (
    <Col className={strong ? `${styles.strong} sk-onstrong` : styles.card}
      style={{ flex: 1, padding: '18px 20px', height: 146, justifyContent: 'space-between' }}>
      <Row className={styles.sp}><Bone w={80} h={14} r={5} />{strong && <Bone fixed w={34} h={34} r="50%" />}</Row>
      <Bone w={strong ? 170 : 150} h={40} r={10} />
      <Bone w={strong ? 150 : 120} h={11} r={4} />
    </Col>
  )
  const Item = ({ on }) => (
    <Row gap={12} className={on ? 'sk-onchip' : ''}
      style={{ padding: '10px 12px', borderRadius: 99, background: on ? 'var(--desk-chip)' : undefined }}>
      <Bone fixed w={22} h={22} r={7} /><Bone fixed w={on ? 70 : 96} h={13} r={5} />
    </Row>
  )
  return (
    <div className={`${styles.frame} ${styles.fDesk}`}>
      <aside className={styles.side}>
        <Row className={styles.sp} style={{ padding: '0 6px 20px' }}>
          <Row gap={10}><Bone fixed w={34} h={34} r={10} /><Bone fixed w={84} h={16} r={5} /></Row>
          <Bone fixed w={22} h={22} r={7} />
        </Row>
        <div style={{ padding: '0 10px 8px' }}><Bone fixed w={40} h={10} r={4} /></div>
        <Item on /><Item /><Item /><Item />
        <div style={{ padding: '16px 10px 8px' }}><Bone fixed w={54} h={10} r={4} /></div>
        <Item on /><Item />
        <Col gap={10} className={`${styles.strong} sk-onstrong`} style={{ marginTop: 'auto', padding: 16, height: 158 }}>
          <Bone w={150} h={15} r={5} /><Bone w={120} h={15} r={5} /><Bone w="90%" h={10} r={4} /><Bone w="70%" h={10} r={4} />
          <div style={{ marginTop: 'auto' }}><Bone fixed w="100%" h={40} r={20} style={{ background: 'var(--sk-hi)' }} /></div>
        </Col>
        <div style={{ marginTop: 8 }}><Item /><Item /></div>
        <Row gap={4} className={styles.chip} style={{ padding: 4, marginTop: 8, borderRadius: 99, height: 44 }}>
          <Bone fixed w={68} h={36} r={18} style={{ background: 'var(--desk-card)' }} />
          <Bone fixed w={62} h={36} r={18} style={{ background: 'transparent' }} />
          <Bone fixed w={62} h={36} r={18} style={{ background: 'transparent' }} />
        </Row>
        <Row gap={10} className={styles.card} style={{ padding: 10, marginTop: 10, borderRadius: 18 }}>
          <Bone fixed w={36} h={36} r="50%" />
          <Col gap={7}><Bone fixed w={80} h={12} r={4} /><Bone fixed w={56} h={10} r={4} /></Col>
        </Row>
      </aside>

      <Col gap={14} className={styles.deskMain}>
        <Row className={styles.sp} style={{ height: 104, alignItems: 'flex-end', paddingBottom: 6 }}>
          <Col gap={12}><Bone w={150} h={12} r={4} /><Bone w={430} h={40} r={10} /></Col>
          <Bone w={164} h={46} r={23} />
        </Row>
        <Row gap={14}><Tile strong /><Tile /><Tile /><Tile /></Row>
        <Row gap={14} style={{ flex: 1, alignItems: 'stretch', minHeight: 0 }}>
          <div className={`${styles.card} ${styles.col}`} style={{ flex: 1, padding: '22px 24px', minWidth: 0 }}>
            <Row className={styles.sp}>
              <Bone w={110} h={20} r={6} />
              <Row gap={34}><Bone w={34} h={34} r="50%" /><Col gap={10} className={styles.ctr}><Bone w={110} h={14} r={5} /><Dots /></Col><Bone w={34} h={34} r="50%" /></Row>
            </Row>
            <Row gap={8} style={{ margin: '22px 0 4px' }}><Bone w={48} h={12} r={4} /><Bone w={22} h={18} r={9} /></Row>
            <PayRow big /><div className={styles.hair} /><PayRow big /><div className={styles.hair} /><PayRow big />
            <div style={{ marginTop: 'auto' }}><Tip /></div>
          </div>
          <Col gap={14} style={{ width: 400 }}>
            <LunaBubble ls={110} bh={62} style={{ padding: '0 4px', gap: 12 }} />
            <div className={`${styles.card} ${styles.col}`} style={{ padding: '20px 22px', height: 262 }}>
              <Bone w={140} h={18} r={6} />
              <div style={{ margin: 'auto' }}>
                <Gauge w={250} h={138} gap={7}><Bone w={70} h={28} r={7} /><Bone w={36} h={10} r={4} /></Gauge>
              </div>
              <Row gap={16} className={styles.jc} style={{ marginTop: 10 }}>{[0, 1, 2].map(i => <Bone key={i} w={60} h={10} r={4} />)}</Row>
            </div>
            <Col gap={10} className={styles.card} style={{ padding: '20px 22px', flex: 1, minHeight: 0 }}>
              <Bone w={110} h={18} r={6} /><Bone w={130} h={11} r={4} /><Bone w={130} h={28} r={8} />
              <div style={{ marginTop: 'auto', height: 84, display: 'flex', alignItems: 'flex-end' }}><Bars heights={BAR_H} w={40} scale={0.8} gap={14} /></div>
            </Col>
          </Col>
        </Row>
      </Col>
    </div>
  )
}

export function SkeletonLoader() {
  return (
    <div className={styles.root} aria-busy="true" role="status">
      <MobileFrame />
      <TabletVFrame />
      <TabletHFrame />
      <DesktopFrame />
    </div>
  )
}

// ── Piezas por sección (mismas formas que las tarjetas reales) ───────────────

// Filas de pago de Inicio: ficha de fecha, nombre + apoyo, monto y menú, con
// separador fino. Va dentro de la tarjeta que ya envuelve la lista real.
// `count`: cuántas filas fantasma (3 por defecto).
export function RailSkeleton({ count = 3 }) {
  return (
    <div className={styles.rows}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.row}>
          <Bone w={44} h={50} r={16} />
          <div className={styles.rowInfo}>
            <Bone w={i % 2 ? '46%' : '38%'} h={14} r={5} />
            <Bone w="22%" h={11} r={5} />
          </div>
          <Bone w={58} h={15} r={5} />
        </div>
      ))}
    </div>
  )
}

// "Por categoría": punto de color + nombre + porcentaje + monto, con
// separador fino (mismo patrón que la leyenda real).
export function CategoryListSkeleton({ count = 4 }) {
  return (
    <div className={styles.rows}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.legendRow}>
          <Bone w={8} h={8} r="50%" />
          <Bone w={i % 2 ? 90 : 110} h={13} r={5} style={{ marginRight: 'auto' }} />
          <Bone w={28} h={11} r={4} />
          <Bone w={54} h={14} r={5} />
        </div>
      ))}
    </div>
  )
}

// Filas de "Pagos realizados": fecha (mes + día), nombre + apoyo, monto y
// menú. Por defecto va dentro de su propia tarjeta (como `.list` de Pagos en
// móvil); con `bare` solo pinta las filas, para usarlo dentro de otra tarjeta.
export function PaymentRowSkeleton({ count = 4, bare }) {
  const rows = (
    <div className={styles.rows}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.row}>
          <div className={styles.dateCol}>
            <Bone w={22} h={9} r={3} />
            <Bone w={20} h={16} r={4} />
          </div>
          <div className={styles.rowInfo}>
            <Bone w={i % 2 ? '46%' : '38%'} h={14} r={5} />
            <Bone w="24%" h={11} r={5} />
          </div>
          <Bone w={54} h={15} r={5} />
          <Bone w={16} h={16} r="50%" />
        </div>
      ))}
    </div>
  )
  return bare ? rows : <div className={styles.cardWrap}>{rows}</div>
}

// Tarjeta de totales (2 bloques lado a lado — usada en Recurrentes).
export function StatsCardSkeleton() {
  return (
    <div className={`${styles.cardWrap} ${styles.statsRow}`}>
      <div className={styles.statsBlock}>
        <Bone w={60} h={10} r={4} />
        <Bone w={40} h={22} r={6} style={{ marginTop: 6 }} />
        <Bone w={70} h={11} r={4} style={{ marginTop: 6 }} />
      </div>
      <div className={styles.statsBlock}>
        <Bone w={80} h={10} r={4} />
        <Bone w={70} h={22} r={6} style={{ marginTop: 6 }} />
        <Bone w={90} h={11} r={4} style={{ marginTop: 6 }} />
      </div>
    </div>
  )
}

// Acordeón de categoría cerrado: ícono redondo + nombre/meta + chevron, en su
// propia tarjeta (mismo patrón que `.group` de Recurrentes).
export function CategoryAccordionSkeleton({ count = 3 }) {
  return (
    <div className={styles.stack}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${styles.cardWrap} ${styles.accItem}`}>
          <Bone w={40} h={40} r="50%" />
          <div className={styles.accText}>
            <Bone w={110} h={14} r={5} />
            <Bone w={80} h={11} r={5} />
          </div>
          <Bone w={18} h={18} r={5} />
        </div>
      ))}
    </div>
  )
}

// Tarjeta de meta: ícono + nombre + monto, barra de progreso y fila inferior.
export function GoalCardSkeleton({ count = 2 }) {
  return (
    <div className={styles.stack}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${styles.cardWrap} ${styles.goalItem}`}>
          <div className={styles.goalTop}>
            <Bone w={40} h={40} r="50%" />
            <Bone w={110} h={15} r={5} />
            <Bone w={60} h={14} r={5} style={{ marginLeft: 'auto' }} />
          </div>
          <Bone w="100%" h={8} r={99} style={{ marginTop: 14 }} />
          <Bone w={130} h={12} r={5} style={{ marginTop: 10 }} />
        </div>
      ))}
    </div>
  )
}
