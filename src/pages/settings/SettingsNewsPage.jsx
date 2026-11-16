import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { SettingsSubLayout } from '../../components/SettingsSubLayout'
import { AnnouncementHistory } from '../../components/Announcement'

// Sub-página «Novedades» (v0.9.1073): historial de comunicados de actualización.
export function SettingsNewsPage({ user, onBack, slideClass }) {
  const { t } = useTranslation()
  return (
    <SettingsSubLayout title={t('announcements.title')} description={t('announcements.description')} icon={Sparkles} onBack={onBack} slideClass={slideClass}>
      <AnnouncementHistory userId={user?.id} createdAt={user?.created_at} />
    </SettingsSubLayout>
  )
}
