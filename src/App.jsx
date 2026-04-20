import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { getSettings, getTodayKey, saveRoutineAction, setSnooze } from './utils/storage'
import {
  checkAndFireAlarms,
  syncAllAlarmNotifications,
  initNotificationChannels,
  registerNotificationActionTypes,
  initNotificationActionListener,
  addRingerModeListener,
  scheduleSnoozeNotification,
  scheduleTestSnoozeNotification,
} from './utils/notifications'
import { TEST_HOURLY_BEHAVIORS } from './utils/alarmContent'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import MorningCheckin from './pages/MorningCheckin'
import Records from './pages/Records'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import CircadianDetailPage from './pages/CircadianDetailPage'
import HealthRecords from './pages/HealthRecords'
import BottomNav from './components/BottomNav'

function AppContent() {
  const location = useLocation()
  const [onboardingDone, setOnboardingDone] = useState(() => {
    return getSettings().onboardingComplete || false
  })

  useEffect(() => {
    const s = getSettings()
    if (!s.onboardingComplete) return

    if (Capacitor.isNativePlatform()) {
      // Native: init channels + action types, then sync all alarms
      initNotificationChannels()
        .then(() => registerNotificationActionTypes())
        .then(() => syncAllAlarmNotifications(s.alarms, s.testMode))

      // Handle notification action buttons (완료 / 나중에 / 건너뜀)
      const removeActionListener = initNotificationActionListener(
        async (periodId, action, snoozeMins = 30) => {
          const today = getTodayKey()
          if (action === 'done' || action === 'skipped') {
            saveRoutineAction(today, periodId, action)
          } else if (action === 'snooze') {
            setSnooze(periodId, Date.now() + snoozeMins * 60 * 1000)
            if (periodId.startsWith('test_')) {
              const hk = periodId.replace('test_', '')
              const behavior = TEST_HOURLY_BEHAVIORS[hk]
              await scheduleTestSnoozeNotification(hk, behavior, snoozeMins)
            } else {
              const settings = getSettings()
              const alarm = settings.alarms.find(a => a.type === periodId)
              if (alarm) await scheduleSnoozeNotification(alarm, snoozeMins)
            }
          }
        },
      )

      // Ringer mode 변경 시 알람 재스케줄 (NORMAL ↔ SILENT/VIBRATE 전환 즉시 반영)
      const removeRingerListener = addRingerModeListener(() => {
        const settings = getSettings()
        syncAllAlarmNotifications(settings.alarms, settings.testMode)
      })

      // 앱이 백그라운드에서 포그라운드로 복귀할 때 재스케줄
      // (백그라운드 중에 ringer mode 가 바뀐 경우 대비)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          const settings = getSettings()
          syncAllAlarmNotifications(settings.alarms, settings.testMode)
        }
      }
      document.addEventListener('visibilitychange', handleVisibilityChange)

      return () => {
        removeActionListener()
        removeRingerListener()
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    } else {
      // Web/PWA: poll every 10 seconds to fire alarms at the right minute
      const tick = () => {
        const settings = getSettings()
        if (settings.onboardingComplete) checkAndFireAlarms(settings.alarms)
      }
      tick()
      const id = setInterval(tick, 10000)
      window.addEventListener('focus', tick)
      return () => {
        clearInterval(id)
        window.removeEventListener('focus', tick)
      }
    }
  }, [])

  if (!onboardingDone) {
    return <Onboarding onComplete={() => setOnboardingDone(true)} />
  }

  return (
    <>
      <div className={`page-content${location.pathname === '/checkin' ? ' page-content-full' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/checkin" element={<MorningCheckin />} />
          <Route path="/records" element={<Records />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/circadian-detail" element={<CircadianDetailPage />} />
          <Route path="/health-records" element={<HealthRecords />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {location.pathname !== '/checkin' && location.pathname !== '/circadian-detail' && <BottomNav />}
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
      <div className="app-container">
        <AppContent />
      </div>
    </HashRouter>
  )
}
