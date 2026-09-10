import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import NicknameSetupPage from './pages/NicknameSetupPage'
import CharacterSetupPage from './pages/CharacterSetupPage'
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
import { syncPendingBoostActions, getActiveTimerState } from './utils/boostAlarm'
import { syncPointsToServer, syncFromServer } from './lib/pointSync'
import { TEST_HOURLY_BEHAVIORS } from './utils/alarmContent'
import { recordPoint, POINT_POLICY } from './utils/pointLedger'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import MorningCheckin from './pages/MorningCheckin'
import Records from './pages/Records'
import Character from './pages/Character'
import Settings from './pages/Settings'
import CircadianDetailPage from './pages/CircadianDetailPage'
import HealthRecords from './pages/HealthRecords'
import HourlyAlarmEdit from './pages/HourlyAlarmEdit'
import PointHistory from './pages/PointHistory'
import BottomNav from './components/BottomNav'

function AppContent() {
  const { user, loading: authLoading, profile, profileLoading, profileError } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [onboardingDone, setOnboardingDone] = useState(() => {
    return getSettings().onboardingComplete || false
  })
  const [exitConfirmVisible, setExitConfirmVisible] = useState(false)
  const [activeTimer, setActiveTimer] = useState(null)   // { alarmLabel, endsAt }
  const [timerDisplay, setTimerDisplay] = useState('')

  // Refs so the back-button listener always reads the latest values
  // without needing to re-register on every render.
  const exitConfirmRef = useRef(false)
  const pathnameRef    = useRef(location.pathname)

  useEffect(() => { exitConfirmRef.current = exitConfirmVisible }, [exitConfirmVisible])
  useEffect(() => { pathnameRef.current    = location.pathname  }, [location.pathname])

  // ─── Hardware back button (Android) ────────────────────────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const subscription = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (exitConfirmRef.current) {
        // Popup is showing — close it instead of exiting
        setExitConfirmVisible(false)
        return
      }
      if (pathnameRef.current === '/' || !canGoBack) {
        // Home page, or history fully exhausted — ask for exit confirmation
        setExitConfirmVisible(true)
      } else {
        // Sub-page with history available — go back
        navigate(-1)
      }
    })

    return () => { subscription.then(handle => handle.remove()) }
  }, [navigate])

  // ─── 포인트 서버 동기화 트리거 ──────────────────────────────────────────────
  // 1) 로그인 성공(user null→non-null) 또는 이미 로그인된 채로 앱 시작 시
  //    server→local 먼저 (다른 기기 데이터 복원), 완료 후 local→server
  useEffect(() => {
    if (user) {
      syncFromServer(user.id).then(() => syncPointsToServer())
    }
  }, [user])

  // 2) recordPoint가 호출된 직후 (pointLedger.js에서 이벤트 발행)
  useEffect(() => {
    const handler = () => syncPointsToServer()
    window.addEventListener('bodyrhythm:pointRecorded', handler)
    return () => window.removeEventListener('bodyrhythm:pointRecorded', handler)
  }, [])

  // ─── Active timer banner countdown ──────────────────────────────────────────
  useEffect(() => {
    if (!activeTimer) { setTimerDisplay(''); return }
    const tick = () => {
      const secs = Math.max(0, Math.floor((activeTimer.endsAt - Date.now()) / 1000))
      if (secs === 0) { setActiveTimer(null); return }
      const m = Math.floor(secs / 60)
      const s = secs % 60
      setTimerDisplay(m > 0 ? `${m}분 ${String(s).padStart(2, '0')}초` : `${s}초`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [activeTimer])

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

      const refreshTimer = async () => {
        try {
          const state = await getActiveTimerState()
          setActiveTimer(state.active
            ? { alarmLabel: state.alarmLabel, endsAt: Date.now() + state.remainingSeconds * 1000 }
            : null)
        } catch {}
      }
      refreshTimer()

      // Handle notification action buttons (완료 / 나중에 / 건너뜀)
      const removeActionListener = initNotificationActionListener(
        async (periodId, action, snoozeMins = 30, firedDate, firstFiredAtMs) => {
          const date = firedDate || getTodayKey()
          const isLate = firstFiredAtMs != null && (Date.now() - firstFiredAtMs) > POINT_POLICY.REACTION_DEADLINE_MS
          if (action === 'done') {
            saveRoutineAction(date, periodId, 'done')
            recordPoint({ date, alarmId: periodId, action: isLate ? 'normal_complete_late' : 'normal_complete', points: isLate ? 0 : undefined })
          } else if (action === 'skipped') {
            saveRoutineAction(date, periodId, 'skipped')
            // 건너뜀 = 0P. 사유 추적을 위해 0P도 원장에 기록한다(policy 4 변경).
            recordPoint({ date, alarmId: periodId, action: 'normal_skipped', points: 0 })
          } else if (action === 'snooze') {
            setSnooze(periodId, Date.now() + snoozeMins * 60 * 1000)
            if (periodId.startsWith('test_')) {
              const hk = periodId.replace('test_', '')
              const behavior = TEST_HOURLY_BEHAVIORS[hk]
              await scheduleTestSnoozeNotification(hk, behavior, snoozeMins, firstFiredAtMs)
            } else {
              const settings = getSettings()
              const alarm = settings.alarms.find(a => a.type === periodId)
              if (alarm) await scheduleSnoozeNotification(alarm, snoozeMins, firstFiredAtMs)
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
          syncPendingBoostActions()
          syncPointsToServer()
          refreshTimer()
        }
      }
      document.addEventListener('visibilitychange', handleVisibilityChange)

      // Capacitor appStateChange: BoostAlarmActivity → MainActivity 전환 시
      // visibilitychange가 발화하지 않는 경우를 위한 이중 안전장치
      const appStateHandle = CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) { syncPendingBoostActions(); syncPointsToServer(); refreshTimer() }
      })

      return () => {
        removeActionListener()
        removeRingerListener()
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        appStateHandle.then(h => h.remove())
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
    // onboardingDone에 의존: 온보딩을 마친 첫 세션에도 리스너/동기화가 등록되도록 함.
    // 온보딩 완료 전에는 위 early-return으로 아무것도 등록하지 않으므로, 이후
    // onboardingDone이 true로 바뀌어 재실행돼도 중복 등록되지 않는다.
  }, [onboardingDone])

  // ─── 인증 로딩 (세션 복원 중, 보통 수십ms) + 프로필 로딩 ─────────────────────
  if (authLoading || (user && profileLoading)) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh', background: 'var(--bg)', gap: 12,
      }}>
        <div style={{ fontSize: 44 }}>⏰</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)' }}>시간건강</div>
      </div>
    )
  }

  // ─── 미인증 → 로그인/회원가입만 노출 ──────────────────────────────────────────
  // 알람 useEffect는 이미 위에서 실행됐으므로 기존 알람 동작에 영향 없음
  if (!user) {
    return (
      <Routes>
        <Route path="/login"  element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="*"       element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // ─── 닉네임 미설정 → 강제 설정 화면 ─────────────────────────────────────────
  // 서버 조회 성공(profileError=false): profile.nickname이 없으면 강제.
  // 서버 조회 실패(profileError=true, 오프라인): 로컬 플래그 nicknameSet_{id}로 판단.
  //   - 플래그 있음(이전에 set_nickname 성공 이력) → 통과
  //   - 플래그 없음(닉네임 미설정 계정) → NicknameSetupPage 강제
  // 서버 조회가 성공하면 항상 서버 값 우선(로컬 플래그 무시).
  const localNicknameSet = profileError && !!localStorage.getItem(`nicknameSet_${user.id}`)
  if (!profile?.nickname && !localNicknameSet) {
    return <NicknameSetupPage />
  }

  if (!onboardingDone) {
    return <Onboarding onComplete={() => setOnboardingDone(true)} />
  }

  // ─── 캐릭터 미설정 → 강제 설정 화면 ─────────────────────────────────────────
  // 닉네임 게이트와 완전히 동일한 패턴.
  // 서버 조회 성공(profileError=false): profile.character_id가 없으면 강제.
  // 서버 조회 실패(profileError=true, 오프라인): 로컬 플래그 characterSet_{id}로 판단.
  //   - 플래그 있음(이전에 set_character 성공 이력) → 통과
  //   - 플래그 없음(캐릭터 미설정 계정) → CharacterSetupPage 강제
  // 서버 조회가 성공하면 항상 서버 값 우선(로컬 플래그 무시).
  const localCharacterSet = profileError && !!localStorage.getItem(`characterSet_${user.id}`)
  if (!profile?.character_id && !localCharacterSet) {
    return <CharacterSetupPage />
  }

  return (
    <>
      {activeTimer && timerDisplay && (
        <div style={{
          padding: '10px 16px', background: '#EDE9FF',
          borderBottom: '1px solid #C9C3F5', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>⏱</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6C5CE7' }}>
              {activeTimer.alarmLabel} 타이머 진행 중
            </div>
            <div style={{ fontSize: 12, color: '#6E6E8A', marginTop: 2 }}>
              {timerDisplay} 후 자동 완료돼요
            </div>
          </div>
        </div>
      )}
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
          <Route path="/point-history" element={<PointHistory />} />
          <Route path="/character-setup" element={<CharacterSetupPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {location.pathname !== '/checkin' && location.pathname !== '/circadian-detail' && location.pathname !== '/hourly-alarm-edit' && location.pathname !== '/point-history' && location.pathname !== '/character-setup' && <BottomNav />}

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
    <AuthProvider>
      <HashRouter>
        <div className="app-container">
          <AppContent />
        </div>
      </HashRouter>
    </AuthProvider>
  )
}
