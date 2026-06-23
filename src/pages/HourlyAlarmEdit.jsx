import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSettings, saveSettings } from '../utils/storage'
import { TEST_HOURLY_BEHAVIORS } from '../utils/alarmContent'
import { syncAllAlarmNotifications } from '../utils/notifications'

const HOURS = Object.keys(TEST_HOURLY_BEHAVIORS).sort()

function resolveHourlySettings(saved = {}) {
  const result = {}
  HOURS.forEach(hk => {
    result[hk] = { enabled: true, boostMode: false, ...saved[hk] }
  })
  return result
}

export default function HourlyAlarmEdit() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState(getSettings)

  const hourlySettings = resolveHourlySettings(settings.hourlyAlarmSettings)

  const updateHour = (hk, patch) => {
    const currentEntry = { enabled: true, boostMode: false, ...settings.hourlyAlarmSettings?.[hk] }
    const newEntry = { ...currentEntry, ...patch }

    if (patch.enabled === false) {
      newEntry.boostMode = false
    }

    const updated = {
      ...settings,
      hourlyAlarmSettings: { ...(settings.hourlyAlarmSettings ?? {}), [hk]: newEntry },
    }
    saveSettings(updated)
    setSettings(updated)

    if (settings.testMode) {
      syncAllAlarmNotifications(updated.alarms, updated.testMode)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 32 }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, #a29bfe 100%)',
        color: 'white',
        padding: '20px 20px 40px',
        paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: 12,
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'white',
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            ‹
          </button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>시간별 알람 편집</div>
            <div style={{ fontSize: 13, opacity: 0.82, marginTop: 2 }}>개별 ON/OFF 및 강화모드 설정</div>
          </div>
        </div>
        <div style={{
          position: 'absolute',
          bottom: -20,
          left: 0,
          right: 0,
          height: 40,
          background: 'var(--bg)',
          borderRadius: '20px 20px 0 0',
        }} />
      </div>

      {/* Legend */}
      <div style={{ padding: '28px 16px 8px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-sub)' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 8,
            background: '#FFF3E0', border: '1.5px solid #F39C12', fontSize: 14,
          }}>🔥</span>
          강화모드
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>· 스위치로 개별 ON/OFF</div>
      </div>

      {/* Alarm list */}
      <div style={{ padding: '4px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {HOURS.map(hk => {
          const behavior = TEST_HOURLY_BEHAVIORS[hk]
          const hs = hourlySettings[hk]
          const h = parseInt(hk, 10)
          const period = h < 12 ? '오전' : '오후'
          const dh = h > 12 ? h - 12 : h
          const timeLabel = `${period} ${dh}:00`

          return (
            <div
              key={hk}
              className="card"
              style={{
                padding: '14px 16px',
                transition: 'opacity 0.2s',
                opacity: hs.enabled ? 1 : 0.55,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Time badge */}
                <div style={{
                  background: hs.enabled ? 'var(--primary-light)' : '#F0EFF8',
                  borderRadius: 10,
                  padding: '6px 10px',
                  flexShrink: 0,
                  textAlign: 'center',
                  minWidth: 54,
                }}>
                  <div style={{ fontSize: 11, color: hs.enabled ? 'var(--primary)' : 'var(--text-sub)', fontWeight: 700, lineHeight: 1 }}>
                    {period}
                  </div>
                  <div style={{ fontSize: 15, color: hs.enabled ? 'var(--primary)' : 'var(--text-sub)', fontWeight: 800, lineHeight: 1.3 }}>
                    {dh}:00
                  </div>
                </div>

                {/* Title */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {behavior.title}
                  </div>
                  {hs.boostMode && hs.enabled && (
                    <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <span style={{
                        fontSize: 11, color: '#E67E22', fontWeight: 700,
                        background: '#FFF3E0', borderRadius: 6, padding: '1px 7px',
                      }}>
                        🔥 강화모드 ON
                      </span>
                    </div>
                  )}
                </div>

                {/* Boost mode button */}
                <button
                  onClick={() => hs.enabled && updateHour(hk, { boostMode: !hs.boostMode })}
                  style={{
                    background: hs.boostMode && hs.enabled ? '#FFF3E0' : '#F5F4FF',
                    border: hs.boostMode && hs.enabled ? '1.5px solid #F39C12' : '1.5px solid var(--border)',
                    borderRadius: 10,
                    width: 38,
                    height: 38,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: hs.enabled ? 'pointer' : 'not-allowed',
                    fontSize: 18,
                    opacity: hs.enabled ? 1 : 0.35,
                    flexShrink: 0,
                    transition: 'all 0.15s',
                  }}
                  aria-label="강화모드"
                  aria-pressed={hs.boostMode}
                >
                  🔥
                </button>

                {/* On/Off toggle */}
                <label className="toggle-wrap" style={{ flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={hs.enabled}
                    onChange={() => updateHour(hk, { enabled: !hs.enabled })}
                  />
                  <div className="toggle-track" />
                </label>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
