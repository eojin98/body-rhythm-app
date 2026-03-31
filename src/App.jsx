import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { getSettings } from './utils/storage'
import { checkAndFireAlarms, syncAllAlarmNotifications } from './utils/notifications'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import MorningCheckin from './pages/MorningCheckin'
import Records from './pages/Records'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
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
      // Native: sync scheduled local notifications on startup
      syncAllAlarmNotifications(s.alarms, s.testMode)
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {location.pathname !== '/checkin' && <BottomNav />}
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
