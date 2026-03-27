import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import {
  getSettings, saveSettings, getRecord, getTodayKey,
  calculatePracticeRate, getNextAlarm, timeUntil,
  formatTime12, DAY_NAMES,
  saveRoutineAction, getSnooze, setSnooze,
} from '../utils/storage'
import {
  getPermissionStatus,
  checkPermissionStatusAsync,
  scheduleAlarmNotifications,
  scheduleSnoozeNotification,
} from '../utils/notifications'
import { ALARM_PERIODS } from '../utils/alarmContent'
import ProgressRing from '../components/ProgressRing'

// Find the most recently triggered alarm that hasn't been acted on
function getActiveRoutineAlarm(alarms, todayRoutines) {
  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const todayDay = now.getDay()

  return alarms
    .filter(a => a.enabled && a.type && a.days.includes(todayDay))
    .map(a => {
      const [h, m] = a.time.split(':').map(Number)
      return { ...a, diffMins: nowMins - (h * 60 + m) }
    })
    .filter(a => a.diffMins >= 0 && a.diffMins <= 120)
    .filter(a => {
      const routine = todayRoutines?.[a.type]
      if (routine?.status === 'done' || routine?.status === 'skipped') return false
      const snoozeUntil = getSnooze(a.type)
      if (snoozeUntil && Date.now() < snoozeUntil) return false
      return true
    })
    .sort((a, b) => a.diffMins - b.diffMins)[0] || null
}

export default function Home() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState(getSettings)
  const [todayRecord, setTodayRecord] = useState(() => getRecord(getTodayKey()))
  const [now, setNow] = useState(new Date())
  const [notifStatus, setNotifStatus] = useState(getPermissionStatus)
  const [activeAlarm, setActiveAlarm] = useState(null)

  useEffect(() => {
    checkPermissionStatusAsync().then(setNotifStatus)
    const tick = () => {
      setNow(new Date())
      const rec = getRecord(getTodayKey())
      setTodayRecord(rec)
      const s = getSettings()
      setActiveAlarm(getActiveRoutineAlarm(s.alarms, rec?.routines))
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [])

  const toggleAlarm = async (id) => {
    const updated = {
      ...settings,
      alarms: settings.alarms.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a),
    }
    saveSettings(updated)
    setSettings(updated)
    const alarm = updated.alarms.find(a => a.id === id)
    if (alarm) await scheduleAlarmNotifications(alarm)
  }

  const handleRoutineAction = (periodId, action) => {
    const today = getTodayKey()
    if (action === 'done' || action === 'skipped') {
      saveRoutineAction(today, periodId, action)
    } else if (action === 'snooze') {
      const snoozeMs = Date.now() + 30 * 60 * 1000
      setSnooze(periodId, snoozeMs)
      const alarm = settings.alarms.find(a => a.type === periodId)
      if (alarm) scheduleSnoozeNotification(alarm)
    }
    const rec = getRecord(today)
    setTodayRecord(rec)
    setActiveAlarm(getActiveRoutineAlarm(settings.alarms, rec?.routines))
  }

  const practiceRate = calculatePracticeRate(todayRecord)
  const nextAlarm = getNextAlarm(settings.alarms)

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

  const showCheckinBtn = !todayRecord?.completed

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
      {notifStatus !== 'granted' && notifStatus !== 'unknown' && (
        <div className="notif-banner">
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span>
            {Capacitor.isNativePlatform()
              ? '알림 권한이 없어 알람이 울리지 않습니다. 설정 탭에서 허용해주세요.'
              : '알림 권한이 없어 알람이 울리지 않을 수 있습니다. 브라우저 설정에서 알림을 허용해주세요.'}
          </span>
        </div>
      )}

      {/* Active routine card */}
      {activeAlarm && (
        <div className="section">
          <ActiveRoutineCard alarm={activeAlarm} onAction={handleRoutineAction} />
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <RoutineBadge label="아침" icon="🌅" status={todayRecord?.routines?.morning?.status} />
                <RoutineBadge label="오후" icon="☀️" status={todayRecord?.routines?.afternoon?.status} />
                <RoutineBadge label="저녁" icon="🌆" status={todayRecord?.routines?.evening?.status} />
                <RoutineBadge label="취침" icon="🌙" status={todayRecord?.routines?.bedtime?.status} />
              </div>
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
            {todayAlarms.map(alarm => {
              const routineStatus = todayRecord?.routines?.[alarm.type]?.status
              return (
                <div key={alarm.id} className={`alarm-item${alarm.past ? ' past' : ''}`}>
                  <div className="alarm-icon-wrap" style={{ background: alarm.past ? '#F0F0F8' : '#EDE9FE' }}>
                    {alarm.icon}
                  </div>
                  <div className="alarm-info">
                    <div className="alarm-name">{alarm.name}</div>
                    <div className="alarm-time">{formatTime12(alarm.time)}</div>
                    {routineStatus && (
                      <div className="alarm-days" style={{ color: routineStatus === 'done' ? '#00B894' : '#A0A0B8' }}>
                        {routineStatus === 'done' ? '✅ 완료' : '⏭ 건너뜀'}
                      </div>
                    )}
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
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Active Routine Card ───────────────────────────────────────────────────────

function ActiveRoutineCard({ alarm, onAction }) {
  const period = ALARM_PERIODS[alarm.type]
  if (!period) return null

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Gradient header */}
      <div style={{ background: period.gradient, padding: '16px 20px', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>{period.icon}</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{period.name}</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              {formatTime12(alarm.time)} 알람 · {alarm.diffMins}분 전
            </div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.85, background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: 20 }}>
            지금 실천해요!
          </div>
        </div>
      </div>

      {/* Behavior list */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {period.behaviors.map((b, i) => (
          <div key={b.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: period.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 12, fontWeight: 700,
            }}>
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{b.title}</div>
              <div style={{ fontSize: 12, color: '#6E6E8A', lineHeight: 1.5 }}>{b.desc}</div>
              <div style={{ fontSize: 11, color: '#A0A0B8', marginTop: 4, padding: '4px 8px', background: '#F5F4FF', borderRadius: 8, display: 'inline-block' }}>
                💡 {b.tip}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8 }}>
        <button
          className="btn btn-ghost btn-sm"
          style={{ flex: 1, color: '#A0A0B8', background: '#F5F5F5' }}
          onClick={() => onAction(alarm.type, 'skipped')}
        >
          건너뛰기
        </button>
        <button
          className="btn btn-secondary btn-sm"
          style={{ flex: 1 }}
          onClick={() => onAction(alarm.type, 'snooze')}
        >
          나중에 (30분)
        </button>
        <button
          className="btn btn-primary btn-sm"
          style={{ flex: 2 }}
          onClick={() => onAction(alarm.type, 'done')}
        >
          완료 ✓
        </button>
      </div>
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function RoutineBadge({ label, icon, status }) {
  const done = status === 'done'
  const skipped = status === 'skipped'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: done ? '#00B894' : skipped ? '#FDCB6E' : '#A0A0B8' }}>
        {label}
      </span>
      <span style={{ fontSize: 11 }}>{done ? '✅' : skipped ? '⏭' : '⬜'}</span>
    </div>
  )
}
