import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { Plus, UserRound, Crown, UsersRound, ChevronDown, Bell } from 'lucide-react'
import { BottomSheet } from './BottomSheet'
import styles from './MobileSpaceChip.module.css'

// Selector de espacio en móvil (v0.9.887, mockup aprobado): un chip con la
// etiqueta "Espacio" que abre una hoja con todos los espacios. Sustituye al
// apilado de tarjetas de SpaceSwitcher.jsx por debajo de 768px. Quien aún no
// tiene espacios compartidos ve además un segundo chip punteado que invita a
// crear uno. Un punto que pulsa avisa que el chip es tocable hasta el primer
// toque (queda guardado en localStorage).
const SEEN_KEY = 'lunapay_space_chip_seen'
function wasSeen() { try { return localStorage.getItem(SEEN_KEY) === '1' } catch { return true } }
function markSeen() { try { localStorage.setItem(SEEN_KEY, '1') } catch { /* sin storage */ } }

export function MobileSpaceChip({ activeSpaceId, sharedSpaces, profile, stats = {}, onSwitch, children }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(wasSeen)

  const spaces = sharedSpaces?.spaces || []
  const entry = (activeSpaceId && activeSpaceId !== 'new') ? spaces.find(s => s.space.id === activeSpaceId) : null
  const isNew = activeSpaceId === 'new'
  const ownedEntry = spaces.find(s => s.membership.role === 'owner')
  const guestCount = spaces.filter(s => s.membership.role === 'guest').length
  const canAddMore = (profile?.is_premium && !ownedEntry) || guestCount < 3
  const noSpaces = spaces.length === 0

  const kindOf = e => e.membership.role === 'owner' ? 'owner' : 'guest'
  const iconOf = kind => kind === 'personal' ? UserRound : kind === 'owner' ? Crown : kind === 'guest' ? UsersRound : Plus

  const activeKind = isNew ? 'new' : entry ? kindOf(entry) : 'personal'
  const ActiveIcon = iconOf(activeKind)
  const activeName = isNew ? t('activeSpaceHeader.newSpaceName') : entry ? entry.space.name : t('activeSpaceHeader.personalName')
  const activeStats = stats[entry ? entry.space.id : 'personal']

  const items = [
    { id: null, kind: 'personal', name: t('activeSpaceHeader.personalName') },
    ...[...spaces]
      .sort((a, b) => a.space.name.localeCompare(b.space.name, i18n.language))
      .map(s => ({ id: s.space.id, kind: kindOf(s), name: s.space.name, count: s.space.members?.length || 0 })),
  ]

  function openSheet() {
    if (!seen) { markSeen(); setSeen(true) }
    setOpen(true)
  }
  function pick(id) { setOpen(false); onSwitch(id) }

  function statText(id) {
    const s = stats[id ?? 'personal']
    if (!s) return null
    if (s.pending === 0) return t('spaceSwitcher.noPending')
    return t('spaceSwitcher.pendingCount', { count: s.pending }) + (s.overdue > 0 ? ` · ${t('spaceSwitcher.overdueCount', { count: s.overdue })}` : '')
  }
  function tagText(item) {
    if (item.kind === 'personal') return t('spaceChip.tagPersonal')
    return t(item.kind === 'owner' ? 'spaceChip.tagOwner' : 'spaceChip.tagGuest', { count: item.count })
  }

  return (
    <>
      <div className={styles.row}>
        <button type="button" data-coachmark="home-space-switcher" className={`${styles.chip} ${noSpaces && canAddMore && !isNew ? styles.chipHug : ''}`} onClick={openSheet} aria-haspopup="dialog" aria-expanded={open}>
          <span className={`${styles.icon} ${activeKind === 'owner' || activeKind === 'guest' ? styles.iconShared : ''}`}><ActiveIcon size={15} strokeWidth={2.2} /></span>
          <span className={styles.texts}>
            <span className={styles.label}>{t('spaceChip.label')}</span>
            <span className={styles.name}>{activeName}</span>
          </span>
          {activeStats?.overdue > 0 && <span className={styles.badge}>{activeStats.overdue}</span>}
          <span className={styles.chev}><ChevronDown size={13} strokeWidth={2.4} /></span>
          {!seen && <i className={styles.pulse} aria-hidden="true" />}
        </button>
        {noSpaces && canAddMore && !isNew && (
          <button type="button" className={styles.addChip} onClick={openSheet}>
            <Plus size={15} strokeWidth={2.4} />{t('spaceChip.addChip')}
          </button>
        )}
        {children}
      </div>

      <BottomSheet open={open} title={noSpaces ? t('spaceChip.newTitle') : t('spaceChip.sheetTitle')} onClose={() => setOpen(false)} modal>
        <p className={styles.intro}>{noSpaces ? t('spaceChip.newIntro') : t('spaceChip.sheetIntro')}</p>
        {noSpaces && (
          <div className={styles.perks}>
            <div className={styles.perk}><span className={styles.perkIc}><UsersRound size={16} /></span><div><b>{t('spaceChip.perk1Title')}</b>{t('spaceChip.perk1Text')}</div></div>
            <div className={styles.perk}><span className={styles.perkIc}><Bell size={16} /></span><div><b>{t('spaceChip.perk2Title')}</b>{t('spaceChip.perk2Text')}</div></div>
          </div>
        )}
        <div className={styles.list}>
          {items.map(item => {
            const Ic = iconOf(item.kind)
            const active = !isNew && item.id === (entry ? entry.space.id : null)
            return (
              <button type="button" key={item.id ?? 'personal'} className={`${styles.opt} ${active ? styles.optOn : ''}`} onClick={() => pick(item.id)}>
                <span className={`${styles.oi} ${item.kind === 'personal' ? styles.oiPersonal : styles.oiShared}`}><Ic size={17} strokeWidth={2} /></span>
                <span className={styles.ot}>
                  <b>{item.name}</b>
                  <span>{noSpaces && item.kind === 'personal' ? t('spaceChip.personalSub') : statText(item.id)}</span>
                  {!noSpaces && <em className={styles.tag}>{tagText(item)}</em>}
                </span>
                {active && <span className={styles.active}>{t('spaceChip.active')}</span>}
              </button>
            )
          })}
        </div>
        {canAddMore && (
          <>
            <button type="button" className={styles.cta} onClick={() => pick('new')}>
              <Plus size={17} strokeWidth={2.4} />{noSpaces ? t('spaceChip.create') : t('activeSpaceHeader.newSpaceName')}
            </button>
            {noSpaces && <button type="button" className={styles.ctaAlt} onClick={() => pick('new')}>{t('spaceChip.haveCode')}</button>}
          </>
        )}
      </BottomSheet>
    </>
  )
}
