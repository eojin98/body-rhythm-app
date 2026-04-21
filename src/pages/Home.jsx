import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import {
  getSettings, saveSettings, getRecord, getTodayKey,
  calculateTodayPracticeRate, getNextAlarm, timeUntil,
  formatTime12, DAY_NAMES,
  saveRoutineAction, clearRoutineAction, getSnooze, setSnooze,
  autoMarkMissedRoutines, getCheckinStatus,
} from '../utils/storage'
import {
  getPermissionStatus,
  checkPermissionStatusAsync,
  scheduleAlarmNotifications,
  scheduleSnoozeNotification,
  scheduleTestSnoozeNotification,
  showNotification,
} from '../utils/notifications'
import { ALARM_PERIODS, getEffectiveBehaviors, TEST_HOURLY_BEHAVIORS, getCurrentPeriodGuide } from '../utils/alarmContent'
import { getCurrentHourData, PHASE_COLORS } from '../data/circadianGuide'
import ProgressRing from '../components/ProgressRing'

// Find the test mode hourly alarm for the current hour
function getActiveTestAlarm(testMode, todayRoutines) {
  if (!testMode) return null
  const now = new Date()
  const hourKey = String(now.getHours()).padStart(2, '0')
  const behavior = TEST_HOURLY_BEHAVIORS[hourKey]
  if (!behavior) return null
  const routineKey = `test_${hourKey}`
  const routine = todayRoutines?.[routineKey]
  if (routine?.status === 'done' || routine?.status === 'skipped') return null
  const snoozeUntil = getSnooze(routineKey)
  if (snoozeUntil && Date.now() < snoozeUntil) return null
  return { hourKey, behavior }
}

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
  const [testAlarm, setTestAlarm] = useState(null)
  const [checkinSkipped, setCheckinSkipped] = useState(() => {
    const today = getTodayKey()
    return getCheckinStatus(today) === 'skipped'
  })

  // Auto-navigate to morning checkin when not completed and not skipped today
  useEffect(() => {
    const today = getTodayKey()
    const status = getCheckinStatus(today)
    if (status === 'completed' || status === 'skipped') return
    const sessionKey = `checkin_prompted_${today}`
    if (sessionStorage.getItem(sessionKey)) return
    sessionStorage.setItem(sessionKey, '1')
    navigate('/checkin')
  }, [])

  useEffect(() => {
    checkPermissionStatusAsync().then(setNotifStatus)
    const tick = () => {
      const nowDate = new Date()
      setNow(nowDate)
      const todayKey2 = getTodayKey()
      const rec = getRecord(todayKey2)
      setTodayRecord(rec)
      setCheckinSkipped(getCheckinStatus(todayKey2) === 'skipped')
      const s = getSettings()
      setSettings(s)
      setActiveAlarm(getActiveRoutineAlarm(s.alarms, rec?.routines))
      setTestAlarm(getActiveTestAlarm(s.testMode, rec?.routines))

      // Auto-mark unchecked past alarms as 'missed'
      autoMarkMissedRoutines(s, testBehaviorKeysConst)

      // Test mode: fire browser notification at the start of each hour
      if (s.testMode && !Capacitor.isNativePlatform()) {
        const m = nowDate.getMinutes()
        if (m < 2) {
          const h = nowDate.getHours()
          const hk = String(h).padStart(2, '0')
          const b = TEST_HOURLY_BEHAVIORS[hk]
          const nKey = `tnotif_${getTodayKey()}_${hk}`
          if (b && !sessionStorage.getItem(nKey)) {
            sessionStorage.setItem(nKey, '1')
            const dh = h === 0 ? 12 : h > 12 ? h - 12 : h
            showNotification(`⏰ ${h < 12 ? '오전' : '오후'} ${dh}:00 루틴`, b.title)
          }
        }
      }
    }
    tick()
    const id = setInterval(tick, 10000)
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

  const handleRoutineAction = async (periodId, action, snoozeMins = 30) => {
    const today = getTodayKey()
    if (action === 'done' || action === 'skipped') {
      saveRoutineAction(today, periodId, action)
    } else if (action === 'clear') {
      clearRoutineAction(today, periodId)
    } else if (action === 'snooze') {
      setSnooze(periodId, Date.now() + snoozeMins * 60 * 1000)
      if (periodId.startsWith('test_')) {
        // 테스트 모드: 별도 알림 예약 (settings.alarms에 없음)
        const hk = periodId.replace('test_', '')
        const behavior = TEST_HOURLY_BEHAVIORS[hk]
        await scheduleTestSnoozeNotification(hk, behavior, snoozeMins)
      } else {
        const alarm = settings.alarms.find(a => a.type === periodId)
        if (alarm) await scheduleSnoozeNotification(alarm, snoozeMins)
      }
    }
    const rec = getRecord(today)
    setTodayRecord(rec)
    setActiveAlarm(getActiveRoutineAlarm(settings.alarms, rec?.routines))
    setTestAlarm(getActiveTestAlarm(settings.testMode, rec?.routines))
  }

  const testBehaviorKeys = Object.keys(TEST_HOURLY_BEHAVIORS)
  const practiceRate = calculateTodayPracticeRate(todayRecord, settings, testBehaviorKeys)
  const nextAlarm = getNextAlarm(settings.alarms)

  // Fired test alarms for today (test mode)
  const now2 = new Date()
  const nowMins2 = now2.getHours() * 60 + now2.getMinutes()
  const firedTestAlarms = settings.testMode
    ? Object.entries(TEST_HOURLY_BEHAVIORS)
        .filter(([hk]) => parseInt(hk, 10) * 60 <= nowMins2)
        .map(([hk, behavior]) => ({
          hk,
          behavior,
          status: todayRecord?.routines?.[`test_${hk}`]?.status || null,
        }))
        .sort((a, b) => a.hk.localeCompare(b.hk))
    : []

  // Fired regular alarms for today (regular mode)
  const firedRegularAlarms = !settings.testMode
    ? settings.alarms
        .filter(a => {
          if (!a.enabled || !a.type || !a.days.includes(now2.getDay())) return false
          const [h, m] = a.time.split(':').map(Number)
          return h * 60 + m <= nowMins2
        })
        .sort((a, b) => a.time.localeCompare(b.time))
    : []

  const firedCount = settings.testMode ? firedTestAlarms.length : firedRegularAlarms.length
  const doneCount = settings.testMode
    ? firedTestAlarms.filter(t => t.status === 'done').length
    : firedRegularAlarms.filter(a => todayRecord?.routines?.[a.type]?.status === 'done').length

  const [hourData, setHourData] = useState(() => getCurrentHourData())
  const [editingKey, setEditingKey] = useState(null)

  // 매 정각마다 시간대 데이터 갱신
  useEffect(() => {
    function scheduleNextHourUpdate() {
      const n = new Date()
      const msUntilNextHour =
        (60 - n.getMinutes()) * 60 * 1000
        - n.getSeconds() * 1000
        - n.getMilliseconds()
      const t = setTimeout(() => {
        setHourData(getCurrentHourData())
        scheduleNextHourUpdate()
      }, msUntilNextHour)
      return t
    }
    const t = scheduleNextHourUpdate()
    return () => clearTimeout(t)
  }, [])

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

      {/* Checkin incomplete badge */}
      {checkinSkipped && (
        <div className="section" style={{ paddingBottom: 0 }}>
          <button
            onClick={() => navigate('/checkin')}
            style={{
              width: '100%', padding: '14px 18px', borderRadius: 16,
              background: 'linear-gradient(135deg, #FDCB6E 0%, #E17055 100%)',
              border: 'none', cursor: 'pointer', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              boxShadow: '0 4px 16px rgba(225,112,85,0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>📋</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>오늘 체크인 미완료</div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 1 }}>탭하여 지금 작성하기</div>
              </div>
            </div>
            <span style={{ fontSize: 18, opacity: 0.8 }}>›</span>
          </button>
        </div>
      )}

      {/* Test mode hourly alarm card */}
      {testAlarm && (
        <div className="section">
          <TestAlarmCard
            hourKey={testAlarm.hourKey}
            behavior={testAlarm.behavior}
            onAction={handleRoutineAction}
          />
        </div>
      )}

      {/* Active routine card */}
      {activeAlarm && (
        <div className="section">
          <ActiveRoutineCard
            alarm={activeAlarm}
            onAction={handleRoutineAction}
            behaviors={getEffectiveBehaviors(activeAlarm.type, settings.behaviors)}
          />
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
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>오늘의 실천율</div>
              {firedCount > 0 ? (
                <div style={{ fontSize: 13, color: '#6E6E8A', marginBottom: 6 }}>
                  {doneCount}개 완료 / {firedCount}개 알람
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#A0A0B8', marginBottom: 6 }}>아직 울린 알람이 없어요</div>
              )}
              {practiceRate === 100 && firedCount > 0 && (
                <div style={{ fontSize: 12, color: '#00B894', fontWeight: 600 }}>완벽한 실천! 🎉</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Current Hour Circadian Guide Card */}
      {(() => {
        const colors = PHASE_COLORS[hourData.phase]
        return (
          <div className="section">
            <div className="section-title">지금 이 시간</div>
            <div className="card" style={{ background: colors.bg, overflow: 'hidden', border: 'none' }}>
              {/* Header */}
              <div style={{ padding: '16px 20px 10px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.accent, marginBottom: 3 }}>
                  {hourData.phaseName} · {hourData.stateName}
                </div>
                <div style={{ fontSize: 11, color: colors.text, opacity: 0.5 }}>
                  {String(now.getHours()).padStart(2, '0')}:00 기준
                </div>
              </div>
              {/* Actions */}
              <div style={{ padding: '0 20px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {hourData.actions.slice(0, 2).map((action, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: colors.accent, flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>{action.label}</span>
                  </div>
                ))}
              </div>
              {/* Warning */}
              {hourData.warnings.length > 0 && (
                <div style={{ margin: '0 20px 12px', padding: '8px 12px', background: 'rgba(0,0,0,0.06)', borderRadius: 10 }}>
                  <span style={{ fontSize: 13, color: colors.text }}>
                    ⚠ {hourData.warnings[0].label}
                  </span>
                </div>
              )}
              {/* Detail button */}
              <div style={{ padding: '0 20px 16px' }}>
                <button
                  onClick={() => navigate('/circadian-detail')}
                  style={{
                    width: '100%', background: colors.accent, color: 'white',
                    border: 'none', borderRadius: 10, padding: '10px 16px',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  자세히 보기 →
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Next Alarm */}
      {nextAlarm && (() => {
        const period = ALARM_PERIODS[nextAlarm.type]
        const gradient = period?.gradient || 'linear-gradient(135deg, #6C5CE7 0%, #a29bfe 100%)'
        const isDark = period?.darkText
        const txt = isDark ? '#1E1E2E' : 'white'
        const txtSub = isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.8)'
        const divider = isDark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.25)'
        const numBg = isDark ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.25)'
        const until = timeUntil(nextAlarm.time, nextAlarm.daysFromNow)
        const behaviors = getEffectiveBehaviors(nextAlarm.type, settings.behaviors)
        return (
          <div className="section">
            <div className="section-title">다음 루틴</div>
            <div className="card card-body" style={{ background: gradient, color: txt, gap: 0 }}>
              {/* Time row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 12, color: txtSub, marginBottom: 3 }}>
                    {nextAlarm.daysFromNow === 0 ? '오늘' : nextAlarm.daysFromNow === 1 ? '내일' : `${nextAlarm.daysFromNow}일 후`}
                    {until && ` · ${until}`}
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.1, color: txt }}>
                    {formatTime12(nextAlarm.time)}
                  </div>
                </div>
                <span style={{ fontSize: 40 }}>{nextAlarm.icon}</span>
              </div>
              {/* Behavior list */}
              {behaviors.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: `1px solid ${divider}`, paddingTop: 12 }}>
                  {behaviors.map((b, i) => (
                    <div key={b.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        background: numBg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: txt,
                      }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: txt }}>{b.title}</span>
                        <span style={{ fontSize: 12, color: txtSub, marginLeft: 6 }}>{b.tip}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Test mode: today's fired hourly alarms */}
      {settings.testMode && firedTestAlarms.length > 0 && (
        <div className="section">
          <div className="section-title">오늘의 시간별 알람 기록</div>
          <div className="card">
            {firedTestAlarms.map(({ hk, behavior, status }) => {
              const h = parseInt(hk, 10)
              const dh = h === 0 ? 12 : h > 12 ? h - 12 : h
              const timeLabel = `${h < 12 ? '오전' : '오후'} ${dh}:00`
              const routineKey = `test_${hk}`
              const isEditing = editingKey === routineKey
              return (
                <div key={hk} style={{ padding: '12px 16px', borderBottom: '1px solid #F0EFF8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: 'linear-gradient(135deg, #6C5CE7 0%, #a29bfe 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    }}>⏰</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{timeLabel} — {behavior.title}</div>
                    </div>
                    {!isEditing ? (
                      <button
                        onClick={() => setEditingKey(routineKey)}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                          background: status === 'done' ? '#E6FBF5' : status === 'skipped' ? '#FFF8E6' : '#F0F0F8',
                          color: status === 'done' ? '#00B894' : status === 'skipped' ? '#E67E22' : '#A0A0B8',
                        }}
                      >
                        {status === 'done' ? '✅ 완료' : status === 'skipped' ? '⏭ 건너뜀' : '— 기록없음'} ✏️
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-primary btn-sm" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => { handleRoutineAction(routineKey, 'done'); setEditingKey(null) }}>완료 ✓</button>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 11, background: '#FFF8E6', color: '#E67E22' }} onClick={() => { handleRoutineAction(routineKey, 'skipped'); setEditingKey(null) }}>건너뜀</button>
                        {status && <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => { handleRoutineAction(routineKey, 'clear'); setEditingKey(null) }}>삭제</button>}
                        <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setEditingKey(null)}>취소</button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
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
              const isEditing = editingKey === alarm.type
              return (
                <div key={alarm.id} className={`alarm-item${alarm.past ? ' past' : ''}`} style={{ flexWrap: 'wrap', gap: 8 }}>
                  <div className="alarm-icon-wrap" style={{ background: alarm.past ? '#F0F0F8' : '#EDE9FE' }}>
                    {alarm.icon}
                  </div>
                  <div className="alarm-info" style={{ flex: 1 }}>
                    <div className="alarm-name">{alarm.name}</div>
                    <div className="alarm-time">{formatTime12(alarm.time)}</div>
                    {routineStatus && !isEditing && (
                      <button
                        onClick={() => setEditingKey(alarm.type)}
                        style={{ marginTop: 2, fontSize: 11, color: routineStatus === 'done' ? '#00B894' : '#E67E22', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                      >
                        {routineStatus === 'done' ? '✅ 완료' : '⏭ 건너뜀'} (수정)
                      </button>
                    )}
                    {alarm.past && !routineStatus && !isEditing && (
                      <button
                        onClick={() => setEditingKey(alarm.type)}
                        style={{ marginTop: 2, fontSize: 11, color: '#A0A0B8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        — 기록 입력
                      </button>
                    )}
                    {isEditing && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                        <button className="btn btn-primary btn-sm" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => { handleRoutineAction(alarm.type, 'done'); setEditingKey(null) }}>완료 ✓</button>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 11, background: '#FFF8E6', color: '#E67E22' }} onClick={() => { handleRoutineAction(alarm.type, 'skipped'); setEditingKey(null) }}>건너뜀</button>
                        {routineStatus && <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => { handleRoutineAction(alarm.type, 'clear'); setEditingKey(null) }}>삭제</button>}
                        <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setEditingKey(null)}>취소</button>
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

const testBehaviorKeysConst = Object.keys(TEST_HOURLY_BEHAVIORS)

// ─── Active Routine Card ───────────────────────────────────────────────────────

function ActiveRoutineCard({ alarm, onAction, behaviors }) {
  const period = ALARM_PERIODS[alarm.type]
  if (!period) return null

  const [checked, setChecked] = useState(() => new Set())

  const isDark = period.darkText
  const headerTxt = isDark ? '#1E1E2E' : 'white'
  const headerSub = isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)'
  const badgeBg = isDark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.2)'
  const effectiveBehaviors = behaviors ?? period.behaviors

  const handleCheck = (id) => {
    const next = new Set(checked)
    if (next.has(id)) {
      next.delete(id)
      setChecked(next)
    } else {
      next.add(id)
      setChecked(next)
      if (next.size === effectiveBehaviors.length) {
        setTimeout(() => onAction(alarm.type, 'done'), 350)
      }
    }
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Gradient header */}
      <div style={{ background: period.gradient, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>{period.icon}</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: headerTxt }}>{period.name}</div>
            <div style={{ fontSize: 12, color: headerSub }}>
              {formatTime12(alarm.time)} 알람 · {alarm.diffMins}분 전
            </div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: headerTxt, background: badgeBg, padding: '4px 10px', borderRadius: 20 }}>
            지금 실천해요!
          </div>
        </div>
      </div>

      {/* Behavior list with individual check buttons */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {effectiveBehaviors.map((b, i) => {
          const isChecked = checked.has(b.id)
          return (
            <div key={b.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <button
                onClick={() => handleCheck(b.id)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: isChecked ? '#00B894' : period.gradient,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 12, fontWeight: 700,
                  border: 'none', cursor: 'pointer', transition: 'background 0.2s',
                }}
              >
                {isChecked ? '✓' : i + 1}
              </button>
              <div style={{ flex: 1, opacity: isChecked ? 0.45 : 1, transition: 'opacity 0.2s' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, textDecoration: isChecked ? 'line-through' : 'none' }}>{b.title}</div>
                <div style={{ fontSize: 12, color: '#6E6E8A', lineHeight: 1.5 }}>{b.desc}</div>
                <div style={{ fontSize: 11, color: '#A0A0B8', marginTop: 4, padding: '4px 8px', background: '#F5F4FF', borderRadius: 8, display: 'inline-block' }}>
                  💡 {b.tip}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Progress hint when partially checked */}
      {checked.size > 0 && checked.size < effectiveBehaviors.length && (
        <div style={{ padding: '0 20px 8px' }}>
          <div style={{ fontSize: 12, color: '#6C5CE7', fontWeight: 600 }}>
            {checked.size}/{effectiveBehaviors.length} 완료 — 모두 체크하면 자동 완료돼요!
          </div>
        </div>
      )}

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
          onClick={() => onAction(alarm.type, 'snooze', 30)}
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

// ─── Test Alarm Card (매 시간별 알람) ─────────────────────────────────────────

function TestAlarmCard({ hourKey, behavior, onAction }) {
  const [isChecked, setIsChecked] = useState(false)

  const h = parseInt(hourKey, 10)
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h
  const period = h < 12 ? '오전' : '오후'
  const timeStr = `${period} ${dh}:00`
  const routineKey = `test_${hourKey}`

  const gradient = h >= 22 || h < 6
    ? 'linear-gradient(135deg, #2C3E50 0%, #4CA1AF 100%)'
    : h >= 18
      ? 'linear-gradient(135deg, #6C5CE7 0%, #a29bfe 100%)'
      : h >= 12
        ? 'linear-gradient(135deg, #43E97B 0%, #38F9D7 100%)'
        : 'linear-gradient(135deg, #F6D365 0%, #FDA085 100%)'

  const isDark = h >= 7 && h < 18
  const txt = isDark ? '#1E1E2E' : 'white'
  const txtSub = isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)'
  const badgeBg = isDark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.2)'

  const handleCheck = () => {
    if (isChecked) return
    setIsChecked(true)
    setTimeout(() => onAction(routineKey, 'done'), 350)
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ background: gradient, padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 26 }}>⏰</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: txt }}>시간별 루틴</div>
            <div style={{ fontSize: 12, color: txtSub }}>{timeStr} 알람 · 매 시간별 알람</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: txt, background: badgeBg, padding: '4px 10px', borderRadius: 20 }}>
            지금 실천해요!
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <button
            onClick={handleCheck}
            style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginTop: 2,
              background: isChecked ? '#00B894' : gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 14, fontWeight: 700,
              border: 'none', cursor: isChecked ? 'default' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {isChecked ? '✓' : '·'}
          </button>
          <div style={{ flex: 1, opacity: isChecked ? 0.45 : 1, transition: 'opacity 0.2s' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, textDecoration: isChecked ? 'line-through' : 'none' }}>{behavior.title}</div>
            <div style={{ fontSize: 13, color: '#6E6E8A', lineHeight: 1.5 }}>{behavior.desc}</div>
            {behavior.tip && (
              <div style={{ fontSize: 11, color: '#A0A0B8', marginTop: 8, padding: '5px 10px', background: '#F5F4FF', borderRadius: 8, display: 'inline-block' }}>
                💡 {behavior.tip}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost btn-sm" style={{ flex: 1, color: '#A0A0B8', background: '#F5F5F5' }} onClick={() => onAction(routineKey, 'skipped')}>건너뛰기</button>
        <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => onAction(routineKey, 'snooze', 10)}>나중에 (10분)</button>
        <button className="btn btn-primary btn-sm" style={{ flex: 2 }} onClick={() => onAction(routineKey, 'done')}>완료 ✓</button>
      </div>
    </div>
  )
}

