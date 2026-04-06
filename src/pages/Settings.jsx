import { useState, useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { getSettings, saveSettings, DAY_NAMES, APP_VERSION, exportAllData, importAllData } from '../utils/storage'
import {
  requestNotificationPermission,
  getPermissionStatus,
  checkPermissionStatusAsync,
  scheduleAlarmNotifications,
  syncAllAlarmNotifications,
  cancelAllAlarmNotifications,
  initNotificationChannels,
} from '../utils/notifications'
import { ALARM_PERIODS, PERIOD_ORDER, getEffectiveBehaviors } from '../utils/alarmContent'

export default function Settings() {
  const [settings, setSettings] = useState(getSettings)
  const [notifStatus, setNotifStatus] = useState(getPermissionStatus)
  const [importMsg, setImportMsg] = useState(null)
  const fileInputRef = useRef(null)

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

  const handleToggleNotifications = async () => {
    const currentlyEnabled = settings.notificationsEnabled !== false
    if (currentlyEnabled) {
      // 알림 끄기: 모든 예약된 알림 취소
      const updated = { ...settings, notificationsEnabled: false }
      persistSettings(updated)
      await cancelAllAlarmNotifications(updated.alarms)
    } else {
      // 알림 켜기: 권한 요청 후 알림 재등록
      const updated = { ...settings, notificationsEnabled: true }
      persistSettings(updated)
      if (notifStatus !== 'granted') {
        const result = await requestNotificationPermission()
        setNotifStatus(result)
      }
      await syncAllAlarmNotifications(updated.alarms, updated.testMode)
    }
  }

  const handleExport = () => {
    const data = exportAllData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bodyrhythm_backup_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result)
        importAllData(data)
        const restored = getSettings()
        setSettings(restored)
        setImportMsg({ type: 'success', text: '데이터를 성공적으로 가져왔습니다. 앱을 새로고침하면 모두 적용됩니다.' })
        syncAllAlarmNotifications(restored.alarms, restored.testMode)
      } catch {
        setImportMsg({ type: 'error', text: '파일을 읽는 중 오류가 발생했습니다. 올바른 백업 파일인지 확인하세요.' })
      }
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  const handleBehaviorChange = (periodId, behaviors) => {
    persistSettings({
      ...settings,
      behaviors: { ...(settings.behaviors || {}), [periodId]: behaviors },
    })
  }

  const handleBehaviorReset = (periodId) => {
    const next = { ...(settings.behaviors || {}) }
    delete next[periodId]
    persistSettings({ ...settings, behaviors: next })
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
              <div style={{ fontSize: 15, fontWeight: 600 }}>알림 사용</div>
              <div style={{ fontSize: 13, color: '#A0A0B8', marginTop: 2 }}>
                {settings.notificationsEnabled !== false ? '알람 알림 켜짐' : '알람 알림 꺼짐'}
                {' · '}
                <span style={{ color: notifStatus === 'granted' ? '#00B894' : '#FF7675' }}>
                  OS 권한 {notifStatus === 'granted' ? '허용' : notifStatus === 'denied' ? '차단' : '미설정'}
                </span>
              </div>
            </div>
            <label className="toggle-wrap">
              <input
                type="checkbox"
                checked={settings.notificationsEnabled !== false}
                onChange={handleToggleNotifications}
              />
              <div className="toggle-track" />
            </label>
          </div>
          {notifStatus !== 'granted' && settings.notificationsEnabled !== false && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: '#FFF8E6', borderRadius: 10, fontSize: 12, color: '#7A5800', lineHeight: 1.5 }}>
              {Capacitor.isNativePlatform()
                ? '⚠️ 기기 설정 > 앱 > Body Rhythm 알람 > 알림에서 허용해주세요.'
                : '⚠️ 알림을 허용해야 알람이 울립니다. 앱이 열려 있을 때만 동작합니다.'}
            </div>
          )}
        </div>
      </div>

      {/* Alarm sound mode */}
      <div className="section">
        <div className="section-title">알람 소리</div>
        <div className="card card-body">
          {[
            { value: 'sound',   label: '소리 + 진동', icon: '🔔' },
            { value: 'vibrate', label: '진동만',       icon: '📳' },
            { value: 'silent',  label: '무음',         icon: '🔕' },
          ].map(opt => {
            const active = (settings.alarmSoundMode ?? 'sound') === opt.value
            return (
              <button
                key={opt.value}
                onClick={async () => {
                  const updated = { ...settings, alarmSoundMode: opt.value }
                  persistSettings(updated)
                  await initNotificationChannels()
                  await syncAllAlarmNotifications(updated.alarms, updated.testMode)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', background: active ? '#F5F4FF' : 'transparent',
                  border: active ? '1.5px solid #6C5CE7' : '1.5px solid transparent',
                  borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
                  marginBottom: 8, textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 22 }}>{opt.icon}</span>
                <span style={{ fontSize: 15, fontWeight: active ? 700 : 500, color: active ? '#6C5CE7' : '#1E1E2E' }}>
                  {opt.label}
                </span>
                {active && <span style={{ marginLeft: 'auto', color: '#6C5CE7', fontSize: 18 }}>✓</span>}
              </button>
            )
          })}
          {Capacitor.isNativePlatform() && (
            <div style={{ fontSize: 12, color: '#A0A0B8', marginTop: 4, lineHeight: 1.5 }}>
              * 채널별 소리/진동은 기기 설정 &gt; 앱 &gt; 알림에서도 조정할 수 있습니다.
            </div>
          )}
        </div>
      </div>

      {/* Beta test mode */}
      <div className="section">
        <div className="section-title">베타 테스트</div>
        <div className="card card-body">
          <div className="row-between">
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>테스트 모드</div>
              <div style={{ fontSize: 13, color: '#A0A0B8', marginTop: 2 }}>매 정시마다 시간별 행동양식 알람</div>
            </div>
            <label className="toggle-wrap">
              <input
                type="checkbox"
                checked={settings.testMode || false}
                onChange={() => {
                  const updated = { ...settings, testMode: !settings.testMode }
                  persistSettings(updated)
                  syncAllAlarmNotifications(updated.alarms, updated.testMode)
                }}
              />
              <div className="toggle-track" />
            </label>
          </div>
          {settings.testMode && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: '#FFF8E6', borderRadius: 8, fontSize: 12, color: '#7A5800', lineHeight: 1.5 }}>
              ⚠️ 앱이 열려 있을 때 매 정시마다 팝업과 알림이 표시됩니다. 베타 테스트 전용입니다.
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
                behaviors={getEffectiveBehaviors(periodId, settings.behaviors)}
              />
            )
          })}
        </div>
      </div>

      {/* Behavior editor */}
      <div className="section">
        <div className="section-title">행동양식 편집</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {PERIOD_ORDER.map(periodId => (
            <BehaviorEditorCard
              key={periodId}
              periodId={periodId}
              period={ALARM_PERIODS[periodId]}
              behaviors={getEffectiveBehaviors(periodId, settings.behaviors)}
              isCustomized={!!settings.behaviors?.[periodId]}
              onChange={(behaviors) => handleBehaviorChange(periodId, behaviors)}
              onReset={() => handleBehaviorReset(periodId)}
            />
          ))}
        </div>
      </div>

      {/* Data management */}
      <div className="section">
        <div className="section-title">데이터 관리</div>
        <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            className="btn"
            onClick={handleExport}
            style={{ width: '100%', background: '#F5F4FF', color: '#6C5CE7', fontWeight: 600, padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14 }}
          >
            📤 데이터 내보내기
          </button>
          <div style={{ fontSize: 12, color: '#A0A0B8', lineHeight: 1.5, paddingLeft: 4 }}>
            설정, 기록 등 모든 데이터를 JSON 파일로 저장합니다.
          </div>
          <div style={{ height: 1, background: '#F0EFF8', margin: '2px 0' }} />
          <button
            className="btn"
            onClick={() => { setImportMsg(null); fileInputRef.current?.click() }}
            style={{ width: '100%', background: '#F0F8FF', color: '#0984E3', fontWeight: 600, padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14 }}
          >
            📥 데이터 가져오기
          </button>
          <div style={{ fontSize: 12, color: '#A0A0B8', lineHeight: 1.5, paddingLeft: 4 }}>
            백업 JSON 파일을 불러와 데이터를 복원합니다. 기존 데이터는 덮어씌워집니다.
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
          {importMsg && (
            <div style={{
              padding: '10px 12px',
              background: importMsg.type === 'success' ? '#E8F8F0' : '#FFE8E8',
              borderRadius: 10,
              fontSize: 13,
              color: importMsg.type === 'success' ? '#00B894' : '#FF7675',
              lineHeight: 1.5,
            }}>
              {importMsg.type === 'success' ? '✅' : '❌'} {importMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* App info */}
      <div className="section" style={{ paddingBottom: 20 }}>
        <div className="section-title">앱 정보</div>
        <div className="card card-body" style={{ color: '#A0A0B8', fontSize: 13, lineHeight: 2 }}>
          <div className="row-between"><span>버전</span><span>{APP_VERSION}</span></div>
          <div className="row-between"><span>데이터 저장</span><span>기기 로컬</span></div>
          <div className="row-between"><span>알람 방식</span><span>{Capacitor.isNativePlatform() ? '로컬 알림 (앱)' : '브라우저 알림'}</span></div>
        </div>
      </div>
    </div>
  )
}

// ─── 시간대 알람 카드 ──────────────────────────────────────────────────────────

function AlarmPeriodCard({ period, alarm, onChange, behaviors }) {
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
              {behaviors.map(b => (
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

// ─── 행동양식 편집 카드 ────────────────────────────────────────────────────────

function BehaviorEditorCard({ periodId, period, behaviors, isCustomized, onChange, onReset }) {
  const [expanded, setExpanded] = useState(false)
  const [editingIdx, setEditingIdx] = useState(null)

  const handleChange = (idx, field, value) => {
    onChange(behaviors.map((b, i) => i === idx ? { ...b, [field]: value } : b))
  }

  const handleDelete = (idx) => {
    onChange(behaviors.filter((_, i) => i !== idx))
    if (editingIdx === idx) setEditingIdx(null)
  }

  const handleAdd = () => {
    onChange([...behaviors, { id: `b_${Date.now()}`, title: '', desc: '', tip: '' }])
    setEditingIdx(behaviors.length)
  }

  return (
    <div className="card">
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ width: 40, height: 40, borderRadius: 12, background: period.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
          {period.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{period.name}</div>
          <div style={{ fontSize: 12, color: '#A0A0B8', marginTop: 1 }}>{behaviors.length}개 행동</div>
        </div>
        {isCustomized && (
          <span style={{ fontSize: 11, color: '#6C5CE7', background: '#EDE9FE', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>편집됨</span>
        )}
        <span style={{ color: '#A0A0B8', fontSize: 13, marginLeft: 4, display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</span>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #F0EFF8', padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {behaviors.map((b, idx) => (
            <div
              key={b.id || idx}
              style={{
                background: editingIdx === idx ? '#F5F4FF' : '#FAFAFA',
                borderRadius: 12,
                padding: '12px 14px',
                border: editingIdx === idx ? '1.5px solid #6C5CE7' : '1px solid #F0EFF8',
              }}
            >
              {editingIdx === idx ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    className="input"
                    placeholder="제목 (예: 햇빛 보기)"
                    value={b.title}
                    onChange={e => handleChange(idx, 'title', e.target.value)}
                    style={{ fontSize: 14, fontWeight: 600 }}
                  />
                  <input
                    className="input"
                    placeholder="설명 (예: 아침 햇빛이 생체시계를 조절합니다)"
                    value={b.desc}
                    onChange={e => handleChange(idx, 'desc', e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                  <input
                    className="input"
                    placeholder="팁 (예: 커튼을 열거나 베란다에 나가보세요)"
                    value={b.tip}
                    onChange={e => handleChange(idx, 'tip', e.target.value)}
                    style={{ fontSize: 12 }}
                  />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                    <button
                      className="btn btn-sm"
                      style={{ background: '#FFE8E8', color: '#FF7675', fontWeight: 600 }}
                      onClick={() => handleDelete(idx)}
                    >
                      삭제
                    </button>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => setEditingIdx(null)}
                    >
                      완료
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1E1E2E' }}>{b.title || '(제목 없음)'}</div>
                    {b.desc ? <div style={{ fontSize: 12, color: '#6E6E8A', marginTop: 2 }}>{b.desc}</div> : null}
                    {b.tip ? <div style={{ fontSize: 11, color: '#A0A0B8', marginTop: 3 }}>💡 {b.tip}</div> : null}
                  </div>
                  <button
                    style={{ background: 'none', border: 'none', color: '#6C5CE7', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '2px 4px', flexShrink: 0 }}
                    onClick={() => setEditingIdx(idx)}
                  >
                    편집
                  </button>
                </div>
              )}
            </div>
          ))}

          <button
            className="btn btn-sm"
            style={{ background: '#F5F4FF', color: '#6C5CE7', fontWeight: 600, marginTop: 4 }}
            onClick={handleAdd}
          >
            + 행동 추가
          </button>

          {isCustomized && (
            <button
              className="btn btn-sm"
              style={{ background: '#FFF8E6', color: '#E67E22', fontWeight: 600 }}
              onClick={() => { onReset(); setEditingIdx(null) }}
            >
              기본값으로 초기화
            </button>
          )}
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
