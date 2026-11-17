import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { SettingsSubLayout } from '../../components/SettingsSubLayout'
import { AnnouncementHistory } from '../../components/Announcement'

// Sub-página «Novedades»: todo lo publicado, desde el día 1 (lo que ya se le
// mostró al usuario con su fecha, y lo que aún no le toca sin ella).
export function SettingsNewsPage({ onBack, slideClass }) {
  const { t } = useTranslation()
  return (
    <SettingsSubLayout title={t('announcements.title')} description={t('announcements.description')} icon={Sparkles} onBack={onBack} slideClass={slideClass}>
      <AnnouncementHistory />
    </SettingsSubLayout>
  )
}
