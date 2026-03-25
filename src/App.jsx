import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getSettings } from './utils/storage'
import { checkAndFireAlarms } from './utils/notifications'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import MorningCheckin from './pages/MorningCheckin'
import Records from './pages/Records'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import BottomNav from './components/BottomNav'

function AppContent() {
  const [onboardingDone, setOnboardingDone] = useState(() => {
    return getSettings().onboardingComplete || false
  })

  useEffect(() => {
    // Check alarms every 30 seconds
    const tick = () => {
      const s = getSettings()
      if (s.onboardingComplete) checkAndFireAlarms(s.alarms)
    }

    tick()
    const id = setInterval(tick, 30000)

    // Also check on window focus
    window.addEventListener('focus', tick)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', tick)
    }
  }, [])

  if (!onboardingDone) {
    return <Onboarding onComplete={() => setOnboardingDone(true)} />
  }

  return (
    <>
      <div className="page-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/checkin" element={<MorningCheckin />} />
          <Route path="/records" element={<Records />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
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
