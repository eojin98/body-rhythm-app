import { useState } from 'react'
import { getSettings, saveSettings, DAY_NAMES, generateId } from '../utils/storage'
import { requestNotificationPermission, getPermissionStatus } from '../utils/notifications'

const ALARM_ICONS = ['🌅', '🍳', '🥗', '🍚', '💪', '🌙', '⏰', '📚', '💊', '🚶', '🧘', '☕']

export default function Settings() {
  const [settings, setSettings] = useState(getSettings)
  const [editingAlarm, setEditingAlarm] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [notifStatus, setNotifStatus] = useState(getPermissionStatus)

  const persistSettings = (updated) => {
    saveSettings(updated)
    setSettings(updated)
  }

  const toggleAlarm = (id) => {
    persistSettings({
      ...settings,
      alarms: settings.alarms.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a)
    })
  }

  const deleteAlarm = (id) => {
    persistSettings({
      ...settings,
      alarms: settings.alarms.filter(a => a.id !== id)
    })
    setEditingAlarm(null)
  }

  const saveAlarm = (alarm) => {
    const exists = settings.alarms.some(a => a.id === alarm.id)
    persistSettings({
      ...settings,
      alarms: exists
        ? settings.alarms.map(a => a.id === alarm.id ? alarm : a)
        : [...settings.alarms, alarm]
    })
    setEditingAlarm(null)
    setShowAddModal(false)
  }

  const handleRequestNotif = async () => {
    const result = await requestNotificationPermission()
    setNotifStatus(result)
  }

  const sortedAlarms = [...settings.alarms].sort((a, b) => a.time.localeCompare(b.time))

  const formatTime12 = (t) => {
    const [h, m] = t.split(':').map(Number)
    const p = h < 12 ? '오전' : '오후'
    const hh = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${p} ${hh}:${String(m).padStart(2, '0')}`
  }

  const formatDays = (days) => {
    if (days.length === 7) return '매일'
    if (days.length === 0) return '없음'
    const weekdays = [1,2,3,4,5]
    const weekends = [0,6]
    if (weekdays.every(d => days.includes(d)) && days.length === 5) return '평일'
    if (weekends.every(d => days.includes(d)) && days.length === 2) return '주말'
    return days.sort().map(d => DAY_NAMES[d] + '요일').join(', ')
  }

  return (
    <div className="page fade-up">
      {/* Header */}
      <div className="page-header">
        <div className="header-title">설정</div>
        <div className="header-sub">알람 및 앱 설정</div>
      </div>

      {/* Notification Status */}
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
            {notifStatus !== 'granted' && (
              <button className="btn btn-secondary btn-sm" onClick={handleRequestNotif}>
                허용하기
              </button>
            )}
            {notifStatus === 'granted' && (
              <div style={{ fontSize: 24 }}>✅</div>
            )}
          </div>
          {notifStatus !== 'granted' && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: '#FFF8E6', borderRadius: 10, fontSize: 12, color: '#7A5800', lineHeight: 1.5 }}>
              ⚠️ 알림을 허용해야 알람을 받을 수 있습니다. 앱이 열려 있을 때만 알람이 울립니다.
            </div>
          )}
        </div>
      </div>

      {/* Base times */}
      <div className="section">
        <div className="section-title">기본 시간</div>
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0EFF8' }}>
            <div className="row-between">
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>기상 시간</div>
                <div style={{ fontSize: 12, color: '#A0A0B8', marginTop: 2 }}>목표 기상 시간</div>
              </div>
              <input
                type="time"
                value={settings.wakeTime}
                onChange={e => persistSettings({ ...settings, wakeTime: e.target.value })}
                className="input input-time"
                style={{ width: 110 }}
              />
            </div>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div className="row-between">
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>취침 시간</div>
                <div style={{ fontSize: 12, color: '#A0A0B8', marginTop: 2 }}>목표 취침 시간</div>
              </div>
              <input
                type="time"
                value={settings.sleepTime}
                onChange={e => persistSettings({ ...settings, sleepTime: e.target.value })}
                className="input input-time"
                style={{ width: 110 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Alarms list */}
      <div className="section">
        <div className="row-between" style={{ marginBottom: 10, padding: '0 4px' }}>
          <div className="section-title" style={{ marginBottom: 0 }}>알람 목록</div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setShowAddModal(true); setEditingAlarm({ id: generateId(), name: '', time: '08:00', days: [0,1,2,3,4,5,6], enabled: true, icon: '⏰', isNew: true }) }}
          >
            + 추가
          </button>
        </div>
        {sortedAlarms.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 20px' }}>
            <div className="empty-state-icon">🔕</div>
            <div className="empty-state-text">알람이 없습니다</div>
          </div>
        ) : (
          <div className="card">
            {sortedAlarms.map((alarm, i) => (
              <div
                key={alarm.id}
                className="alarm-item"
                style={{ cursor: 'pointer' }}
              >
                <div
                  className="alarm-icon-wrap"
                  onClick={() => setEditingAlarm(alarm)}
                  style={{ cursor: 'pointer' }}
                >
                  {alarm.icon}
                </div>
                <div className="alarm-info" onClick={() => setEditingAlarm(alarm)}>
                  <div className="alarm-name">{alarm.name || '이름 없음'}</div>
                  <div className="alarm-time">{formatTime12(alarm.time)}</div>
                  <div className="alarm-days">{formatDays(alarm.days)}</div>
                </div>
                <label className="toggle-wrap" onClick={e => e.stopPropagation()}>
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

      {/* App info */}
      <div className="section" style={{ paddingBottom: 20 }}>
        <div className="section-title">앱 정보</div>
        <div className="card card-body" style={{ color: '#A0A0B8', fontSize: 13, lineHeight: 2 }}>
          <div className="row-between"><span>버전</span><span>1.0.0</span></div>
          <div className="row-between"><span>데이터 저장</span><span>기기 로컬</span></div>
          <div className="row-between"><span>알람 방식</span><span>브라우저 알림</span></div>
        </div>
      </div>

      {/* Edit/Add Modal */}
      {(editingAlarm || showAddModal) && (
        <AlarmModal
          alarm={editingAlarm}
          onSave={saveAlarm}
          onDelete={!editingAlarm?.isNew ? () => deleteAlarm(editingAlarm.id) : null}
          onClose={() => { setEditingAlarm(null); setShowAddModal(false) }}
        />
      )}
    </div>
  )
}

function AlarmModal({ alarm, onSave, onDelete, onClose }) {
  const [name, setName] = useState(alarm.name || '')
  const [time, setTime] = useState(alarm.time || '08:00')
  const [days, setDays] = useState(alarm.days || [0,1,2,3,4,5,6])
  const [icon, setIcon] = useState(alarm.icon || '⏰')
  const [enabled, setEnabled] = useState(alarm.enabled ?? true)

  const toggleDay = (d) => setDays(prev =>
    prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
  )

  const handleSave = () => {
    onSave({ ...alarm, name, time, days, icon, enabled })
  }

  const presetDays = [
    { label: '매일', value: [0,1,2,3,4,5,6] },
    { label: '평일', value: [1,2,3,4,5] },
    { label: '주말', value: [0,6] },
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-title">{alarm.isNew ? '알람 추가' : '알람 편집'}</div>

        {/* Icon picker */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6E8A', marginBottom: 10 }}>아이콘</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ALARM_ICONS.map(ic => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                style={{
                  width: 42, height: 42, borderRadius: 12, fontSize: 22,
                  background: icon === ic ? '#EDE9FE' : '#F5F5F5',
                  border: icon === ic ? '2px solid #6C5CE7' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div className="input-group">
          <label className="input-label">알람 이름</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="input"
            placeholder="예: 기상, 점심 식사"
            maxLength={20}
          />
        </div>

        {/* Time */}
        <div className="input-group">
          <label className="input-label">알람 시간</label>
          <input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            className="input input-time"
          />
        </div>

        {/* Days */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6E8A', marginBottom: 8 }}>반복 요일</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {presetDays.map(p => (
              <button
                key={p.label}
                onClick={() => setDays(p.value)}
                className="btn btn-sm"
                style={{
                  background: JSON.stringify(days.sort()) === JSON.stringify([...p.value].sort()) ? '#6C5CE7' : '#F0EFF8',
                  color: JSON.stringify(days.sort()) === JSON.stringify([...p.value].sort()) ? 'white' : '#6E6E8A',
                  padding: '6px 12px',
                }}
              >
                {p.label}
              </button>
            ))}
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

        {/* Enabled */}
        <div className="row-between">
          <span style={{ fontSize: 15, fontWeight: 600 }}>알람 활성화</span>
          <label className="toggle-wrap">
            <input type="checkbox" checked={enabled} onChange={() => setEnabled(e => !e)} />
            <div className="toggle-track" />
          </label>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          {onDelete && (
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={onDelete}>
              삭제
            </button>
          )}
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            취소
          </button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave}>
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
