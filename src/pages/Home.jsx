import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getSettings, saveSettings, getRecord, getTodayKey,
  calculatePracticeRate, getNextAlarm, timeUntil,
  formatTime12, DAY_NAMES
} from '../utils/storage'
import { getPermissionStatus } from '../utils/notifications'
import ProgressRing from '../components/ProgressRing'

export default function Home() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState(getSettings)
  const [todayRecord, setTodayRecord] = useState(() => getRecord(getTodayKey()))
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date())
      setTodayRecord(getRecord(getTodayKey()))
    }, 30000)
    return () => clearInterval(id)
  }, [])

  const toggleAlarm = (id) => {
    const updated = {
      ...settings,
      alarms: settings.alarms.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a)
    }
    saveSettings(updated)
    setSettings(updated)
  }

  const practiceRate = calculatePracticeRate(todayRecord)
  const nextAlarm = getNextAlarm(settings.alarms)
  const notifStatus = getPermissionStatus()

  const greetings = () => {
    const h = now.getHours()
    if (h < 6) return '좋은 새벽이에요'
    if (h < 12) return '좋은 아침이에요'
    if (h < 18) return '좋은 오후예요'
    return '좋은 저녁이에요'
  }

  const todayStr = (() => {
    const d = now
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${DAY_NAMES[d.getDay()]}요일`
  })()

  const showCheckinBtn = (() => {
    const h = now.getHours()
    return h >= 5 && h < 14 && !todayRecord?.completed
  })()

  // Sort alarms by time, mark past ones
  const todayAlarms = settings.alarms
    .filter(a => a.days.includes(now.getDay()))
    .map(a => {
      const [ah, am] = a.time.split(':').map(Number)
      const past = ah * 60 + am < now.getHours() * 60 + now.getMinutes()
      return { ...a, past }
    })
    .sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div className="page fade-up">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>{todayStr}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{greetings()} 👋</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>
              {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
            </div>
          </div>
        </div>
      </div>

      {/* Notification warning */}
      {notifStatus !== 'granted' && (
        <div className="notif-banner">
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span>알림 권한이 없어 알람이 울리지 않을 수 있습니다. 브라우저 설정에서 알림을 허용해주세요.</span>
        </div>
      )}

      {/* Practice Rate Card */}
      <div className="section">
        <div className="card card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div className="progress-ring-wrap" style={{ position: 'relative', width: 100, height: 100 }}>
              <ProgressRing percent={practiceRate} size={100} strokeWidth={9} />
              <div className="progress-ring-inner">
                <div style={{ fontSize: 22, fontWeight: 800, color: '#6C5CE7' }}>{practiceRate}%</div>
                <div style={{ fontSize: 10, color: '#A0A0B8', fontWeight: 500 }}>실천율</div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>오늘의 실천율</div>
              {todayRecord?.completed ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <ScoreBadge label="기상" done={todayRecord.wakeOnTime} />
                  <ScoreBadge label="식사" done={[todayRecord.meals?.breakfast, todayRecord.meals?.lunch, todayRecord.meals?.dinner].filter(Boolean).length >= 2} />
                  <ScoreBadge label="운동" done={todayRecord.exercise} />
                </div>
              ) : (
                <div style={{ color: '#A0A0B8', fontSize: 13, lineHeight: 1.6 }}>
                  아침 체크인을 완료하면<br />실천율이 계산됩니다
                </div>
              )}
            </div>
          </div>
          {showCheckinBtn && (
            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: 16 }}
              onClick={() => navigate('/checkin')}
            >
              아침 체크인 시작 →
            </button>
          )}
        </div>
      </div>

      {/* Next Alarm */}
      {nextAlarm && (
        <div className="section">
          <div className="section-title">다음 알람</div>
          <div className="card card-body" style={{ background: 'linear-gradient(135deg, #6C5CE7 0%, #a29bfe 100%)', color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>
                  {nextAlarm.daysFromNow === 0 ? '오늘' : nextAlarm.daysFromNow === 1 ? '내일' : `${nextAlarm.daysFromNow}일 후`}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>
                  {formatTime12(nextAlarm.time)}
                </div>
                <div style={{ fontSize: 14, opacity: 0.85, marginTop: 2 }}>
                  {nextAlarm.icon} {nextAlarm.name}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  {timeUntil(nextAlarm.time, nextAlarm.daysFromNow)}
                </div>
                <div style={{ fontSize: 32, marginTop: 4 }}>🔔</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Today's Alarms */}
      <div className="section">
        <div className="section-title">오늘의 알람</div>
        {todayAlarms.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">😴</div>
            <div className="empty-state-text">오늘 활성화된 알람이 없습니다</div>
          </div>
        ) : (
          <div className="card">
            {todayAlarms.map(alarm => (
              <div key={alarm.id} className={`alarm-item${alarm.past ? ' past' : ''}`}>
                <div className="alarm-icon-wrap" style={{ background: alarm.past ? '#F0F0F8' : '#EDE9FE' }}>
                  {alarm.icon}
                </div>
                <div className="alarm-info">
                  <div className="alarm-name">{alarm.name}</div>
                  <div className="alarm-time">{formatTime12(alarm.time)}</div>
                </div>
                <label className="toggle-wrap">
                  <input
                    type="checkbox"
                    checked={alarm.enabled}
                    onChange={() => toggleAlarm(alarm.id)}
                  />
                  <div className="toggle-track" />
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ScoreBadge({ label, done }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 14 }}>{done ? '✅' : '⬜'}</span>
      <span style={{ fontSize: 13, color: done ? '#00B894' : '#A0A0B8', fontWeight: 500 }}>{label}</span>
    </div>
  )
}
