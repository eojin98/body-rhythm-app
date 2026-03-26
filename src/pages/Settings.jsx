import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { getSettings, saveSettings, DAY_NAMES } from '../utils/storage'
import {
  requestNotificationPermission,
  getPermissionStatus,
  checkPermissionStatusAsync,
  scheduleAlarmNotifications,
} from '../utils/notifications'
import { ALARM_PERIODS, PERIOD_ORDER } from '../utils/alarmContent'

export default function Settings() {
  const [settings, setSettings] = useState(getSettings)
  const [notifStatus, setNotifStatus] = useState(getPermissionStatus)

  useEffect(() => {
    checkPermissionStatusAsync().then(setNotifStatus)
  }, [])

  const persistSettings = (updated) => {
    saveSettings(updated)
    setSettings(updated)
  }

  const updateAlarm = async (type, patch) => {
    const updated = {
      ...settings,
      alarms: settings.alarms.map(a => a.type === type ? { ...a, ...patch } : a),
    }
    persistSettings(updated)
    const alarm = updated.alarms.find(a => a.type === type)
    if (alarm) await scheduleAlarmNotifications(alarm)
  }

  const handleRequestNotif = async () => {
    const result = await requestNotificationPermission()
    setNotifStatus(result)
  }

  return (
    <div className="page fade-up">
      {/* Header */}
      <div className="page-header">
        <div className="header-title">설정</div>
        <div className="header-sub">알람 및 앱 설정</div>
      </div>

      {/* Notification permission */}
      <div className="section">
        <div className="section-title">알림</div>
        <div className="card card-body">
          <div className="row-between">
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>알림 권한</div>
              <div style={{ fontSize: 13, color: notifStatus === 'granted' ? '#00B894' : '#FF7675', marginTop: 2 }}>
                {notifStatus === 'granted' ? '허용됨' : notifStatus === 'denied' ? '차단됨' : '미설정'}
              </div>
            </div>
            {notifStatus !== 'granted'
              ? <button className="btn btn-secondary btn-sm" onClick={handleRequestNotif}>허용하기</button>
              : <div style={{ fontSize: 24 }}>✅</div>
            }
          </div>
          {notifStatus !== 'granted' && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: '#FFF8E6', borderRadius: 10, fontSize: 12, color: '#7A5800', lineHeight: 1.5 }}>
              {Capacitor.isNativePlatform()
                ? '⚠️ 기기 설정 > 앱 > Body Rhythm 알람 > 알림에서 허용해주세요.'
                : '⚠️ 알림을 허용해야 알람이 울립니다. 앱이 열려 있을 때만 동작합니다.'}
            </div>
          )}
        </div>
      </div>

      {/* Behavior alarms */}
      <div className="section">
        <div className="section-title">시간대별 알람</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {PERIOD_ORDER.map(periodId => {
            const period = ALARM_PERIODS[periodId]
            const alarm = settings.alarms.find(a => a.type === periodId) || {}
            return (
              <AlarmPeriodCard
                key={periodId}
                period={period}
                alarm={alarm}
                onChange={(patch) => updateAlarm(periodId, patch)}
              />
            )
          })}
        </div>
      </div>

      {/* App info */}
      <div className="section" style={{ paddingBottom: 20 }}>
        <div className="section-title">앱 정보</div>
        <div className="card card-body" style={{ color: '#A0A0B8', fontSize: 13, lineHeight: 2 }}>
          <div className="row-between"><span>버전</span><span>1.0.0</span></div>
          <div className="row-between"><span>데이터 저장</span><span>기기 로컬</span></div>
          <div className="row-between"><span>알람 방식</span><span>{Capacitor.isNativePlatform() ? '로컬 알림 (앱)' : '브라우저 알림'}</span></div>
        </div>
      </div>
    </div>
  )
}

// ─── 시간대 알람 카드 ──────────────────────────────────────────────────────────

function AlarmPeriodCard({ period, alarm, onChange }) {
  const [expanded, setExpanded] = useState(false)

  const toggleDay = (d) => {
    const days = alarm.days || []
    onChange({ days: days.includes(d) ? days.filter(x => x !== d) : [...days, d] })
  }

  const presets = [
    { label: '매일', value: [0, 1, 2, 3, 4, 5, 6] },
    { label: '평일', value: [1, 2, 3, 4, 5] },
    { label: '주말', value: [0, 6] },
  ]

  const days = alarm.days || []

  return (
    <div className="card" style={{ overflow: 'visible' }}>
      {/* Top row */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Icon with gradient */}
        <div style={{
          width: 44, height: 44, borderRadius: 14, background: period.gradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
        }}>
          {period.icon}
        </div>

        {/* Name + time */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{period.name}</div>
          <div style={{ fontSize: 13, color: '#A0A0B8', marginTop: 1 }}>
            {alarm.time || period.defaultTime}
            {' · '}
            {formatDays(days)}
          </div>
        </div>

        {/* Toggle */}
        <label className="toggle-wrap" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={alarm.enabled ?? true}
            onChange={() => onChange({ enabled: !alarm.enabled })}
          />
          <div className="toggle-track" />
        </label>

        {/* Expand arrow */}
        <div style={{ color: '#A0A0B8', fontSize: 12, marginLeft: 4, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
          ›
        </div>
      </div>

      {/* Expanded: time + days */}
      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid #F0EFF8', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Time */}
          <div className="input-group">
            <label className="input-label">알람 시간</label>
            <input
              type="time"
              value={alarm.time || period.defaultTime}
              onChange={e => onChange({ time: e.target.value })}
              className="input input-time"
            />
          </div>

          {/* Days presets */}
          <div>
            <div className="input-label" style={{ marginBottom: 8 }}>반복 요일</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {presets.map(p => {
                const match = JSON.stringify([...days].sort()) === JSON.stringify([...p.value].sort())
                return (
                  <button
                    key={p.label}
                    className="btn btn-sm"
                    style={{ background: match ? '#6C5CE7' : '#F0EFF8', color: match ? 'white' : '#6E6E8A', padding: '6px 12px' }}
                    onClick={() => onChange({ days: p.value })}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
            <div className="days-selector" style={{ justifyContent: 'space-between' }}>
              {DAY_NAMES.map((d, i) => (
                <button
                  key={i}
                  className={`day-btn${days.includes(i) ? ' selected' : ''}`}
                  onClick={() => toggleDay(i)}
                  style={{ color: i === 0 ? (days.includes(i) ? 'white' : '#FF7675') : i === 6 ? (days.includes(i) ? 'white' : '#6C5CE7') : undefined }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Behavior preview */}
          <div>
            <div className="input-label" style={{ marginBottom: 8 }}>알람 내용</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {period.behaviors.map(b => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#F5F4FF', borderRadius: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#6C5CE7' }}>{b.title}</span>
                  <span style={{ fontSize: 12, color: '#A0A0B8' }}>— {b.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDays(days) {
  if (!days || days.length === 0) return '없음'
  if (days.length === 7) return '매일'
  if ([1, 2, 3, 4, 5].every(d => days.includes(d)) && days.length === 5) return '평일'
  if ([0, 6].every(d => days.includes(d)) && days.length === 2) return '주말'
  return [...days].sort().map(d => DAY_NAMES[d]).join('·')
}
