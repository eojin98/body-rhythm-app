import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
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
import { syncPendingBoostActions } from './utils/boostAlarm'
import { TEST_HOURLY_BEHAVIORS } from './utils/alarmContent'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import MorningCheckin from './pages/MorningCheckin'
import Records from './pages/Records'
import Character from './pages/Character'
import Settings from './pages/Settings'
import CircadianDetailPage from './pages/CircadianDetailPage'
import HealthRecords from './pages/HealthRecords'
import HourlyAlarmEdit from './pages/HourlyAlarmEdit'
import BottomNav from './components/BottomNav'

function AppContent() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [onboardingDone, setOnboardingDone] = useState(() => {
    return getSettings().onboardingComplete || false
  })
  const [exitConfirmVisible, setExitConfirmVisible] = useState(false)

  // Refs so the back-button listener always reads the latest values
  // without needing to re-register on every render.
  const exitConfirmRef = useRef(false)
  const pathnameRef    = useRef(location.pathname)

  useEffect(() => { exitConfirmRef.current = exitConfirmVisible }, [exitConfirmVisible])
  useEffect(() => { pathnameRef.current    = location.pathname  }, [location.pathname])

  // ─── Hardware back button (Android) ────────────────────────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const subscription = CapApp.addListener('backButton', () => {
      if (exitConfirmRef.current) {
        // Popup is showing — close it instead of exiting
        setExitConfirmVisible(false)
        return
      }
      if (pathnameRef.current === '/') {
        // Home (top-level) — ask for exit confirmation
        setExitConfirmVisible(true)
      } else {
        // Sub-page — go back
        navigate(-1)
      }
    })

    return () => { subscription.then(handle => handle.remove()) }
  }, [navigate])

  // ─── Alarm / notification setup ─────────────────────────────────────────────
  useEffect(() => {
    const s = getSettings()
    if (!s.onboardingComplete) return

    if (Capacitor.isNativePlatform()) {
      // Native: init channels + action types, then sync all alarms
      initNotificationChannels()
        .then(() => registerNotificationActionTypes())
        .then(() => syncAllAlarmNotifications(s.alarms, s.testMode))

      // Sync any done/skipped actions recorded by BoostAlarmActivity while app was dead
      syncPendingBoostActions()

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
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          const settings = getSettings()
          syncAllAlarmNotifications(settings.alarms, settings.testMode)
          syncPendingBoostActions()
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
          <Route path="/character" element={<Character />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/circadian-detail" element={<CircadianDetailPage />} />
          <Route path="/health-records" element={<HealthRecords />} />
          <Route path="/hourly-alarm-edit" element={<HourlyAlarmEdit />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {location.pathname !== '/checkin' && location.pathname !== '/circadian-detail' && location.pathname !== '/hourly-alarm-edit' && <BottomNav />}

      {/* ─── 앱 종료 확인 팝업 ─────────────────────────────────────────── */}
      {exitConfirmVisible && (
        <div
          onClick={() => setExitConfirmVisible(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(10, 10, 30, 0.60)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 32px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              borderRadius: 24,
              padding: '32px 24px 24px',
              width: '100%',
              maxWidth: 300,
              textAlign: 'center',
              boxShadow: '0 12px 40px rgba(108, 92, 231, 0.20)',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 14 }}>🚪</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1A1A2E', marginBottom: 8 }}>
              앱을 종료하시겠어요?
            </div>
            <div style={{ fontSize: 13, color: '#A0A0B8', lineHeight: 1.6, marginBottom: 26 }}>
              종료 후 알람은 계속 동작합니다.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setExitConfirmVisible(false)}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 14,
                  border: '1.5px solid #E0DEFF',
                  background: '#F5F4FF', color: '#6C5CE7',
                  fontSize: 15, fontWeight: 600, cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={() => CapApp.exitApp()}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 14,
                  border: 'none',
                  background: 'linear-gradient(135deg, #6C5CE7, #A29BFE)',
                  color: '#FFFFFF',
                  fontSize: 15, fontWeight: 600, cursor: 'pointer',
                }}
              >
                종료
              </button>
            </div>
          </div>
        </div>
      )}
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
