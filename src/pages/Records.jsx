import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRecords, calculatePracticeRate, saveRoutineAction, clearRoutineAction, DAY_NAMES, getTodayKey, getLastWeekDates } from '../utils/storage'
import { ALARM_PERIODS, PERIOD_ORDER, TEST_HOURLY_BEHAVIORS } from '../utils/alarmContent'

export default function Records() {
  const navigate = useNavigate()
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(getTodayKey())
  const [records, setRecords] = useState(getRecords)

  const refresh = useCallback(() => setRecords(getRecords()), [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 5000)
    const onVisible = () => { if (!document.hidden) refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const todayKey = getTodayKey()

  const dateKey = (d) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const selectedRecord = records[selectedDate] || null

  const getRateColor = (rate) => {
    if (rate === 0) return null
    if (rate < 50) return '#FF7675'
    if (rate < 75) return '#FDCB6E'
    return '#00B894'
  }

  // Weekly summary data
  const weekDates = getLastWeekDates()
  const trackedDays = weekDates.filter(d => records[d.key])
  const weekAvg = trackedDays.length > 0
    ? Math.round(trackedDays.reduce((s, d) => s + calculatePracticeRate(records[d.key]), 0) / trackedDays.length)
    : 0

  return (
    <div className="page fade-up">
      {/* Header */}
      <div className="page-header">
        <div className="header-title">기록</div>
        <div className="header-sub">날짜별 실천 기록을 확인하세요</div>
      </div>

      {/* Health Records shortcut */}
      <div className="section">
        <button
          onClick={() => navigate('/health-records')}
          style={{
            width: '100%', padding: '14px 18px', borderRadius: 16,
            background: 'linear-gradient(135deg, #6C5CE7 0%, #a29bfe 100%)',
            border: 'none', cursor: 'pointer', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 4px 16px rgba(108,92,231,0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🏥</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>건강 기록 조회</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 1 }}>수면 · 식사 · 운동 이력</div>
            </div>
          </div>
          <span style={{ fontSize: 18, opacity: 0.8 }}>›</span>
        </button>
      </div>

      {/* Weekly summary */}
      <div className="section">
        <div className="section-title">최근 7일 요약</div>
        <div className="card card-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: '#A0A0B8' }}>7일 평균 실천율</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#6C5CE7', lineHeight: 1.1 }}>{weekAvg}%</div>
            </div>
            <div style={{ fontSize: 13, color: '#A0A0B8', textAlign: 'right' }}>
              <div>{trackedDays.length}일 기록</div>
              <div style={{ fontSize: 11, marginTop: 2 }}>/ 7일</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {weekDates.map(({ key, label }) => {
              const rec = records[key]
              const rate = rec ? calculatePracticeRate(rec) : null
              const dotColor = rate !== null ? (rate >= 75 ? '#00B894' : rate >= 50 ? '#FDCB6E' : '#FF7675') : '#EEEEEE'
              const isToday = key === todayKey
              const isSelected = key === selectedDate
              return (
                <div
                  key={key}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer' }}
                  onClick={() => setSelectedDate(key)}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: isSelected ? '#6C5CE7' : dotColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    color: (isSelected || rate !== null) ? 'white' : '#CCC',
                    border: isToday && !isSelected ? '2px solid #6C5CE7' : 'none',
                    boxSizing: 'border-box',
                  }}>
                    {rate !== null ? `${rate}%` : '—'}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? '#6C5CE7' : '#A0A0B8' }}>{label}</div>
                  {rec?.completed && (
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#6C5CE7' }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="section">
        <div className="card card-body">
          {/* Month nav */}
          <div className="row-between" style={{ marginBottom: 16 }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6C5CE7', padding: 4 }}>‹</button>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {viewYear}년 {viewMonth + 1}월
            </div>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6C5CE7', padding: 4 }}>›</button>
          </div>

          {/* Day headers */}
          <div className="calendar-grid" style={{ marginBottom: 6 }}>
            {DAY_NAMES.map((d, i) => (
              <div key={d} className="cal-day-header" style={{ color: i === 0 ? '#FF7675' : i === 6 ? '#6C5CE7' : undefined }}>
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="calendar-grid">
            {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = i + 1
              const key = dateKey(d)
              const rec = records[key]
              const rate = rec ? calculatePracticeRate(rec) : 0
              const isToday = key === todayKey
              const isSelected = key === selectedDate
              const dotColor = rate > 0 ? getRateColor(rate) : null
              const dow = new Date(viewYear, viewMonth, d).getDay()

              return (
                <div
                  key={d}
                  className={`cal-day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
                  onClick={() => setSelectedDate(key)}
                  style={{
                    color: isSelected ? 'white' : dow === 0 ? '#FF7675' : dow === 6 ? '#6C5CE7' : undefined,
                    fontWeight: isToday || isSelected ? 700 : 400,
                  }}
                >
                  {d}
                  {dotColor && !isSelected && (
                    <div className="dot" style={{ background: dotColor }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 14 }}>
            {[['#00B894', '75%+'], ['#FDCB6E', '50%+'], ['#FF7675', '50% 미만']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                <span style={{ fontSize: 11, color: '#A0A0B8' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Selected day detail */}
      <div className="section">
        <div className="section-title">
          {selectedDate.replace(/(\d{4})-(\d{2})-(\d{2})/, '$1년 $2월 $3일')} 기록
        </div>
        {selectedRecord ? (
          <RecordDetail record={selectedRecord} dateKey={selectedDate} onUpdate={refresh} />
        ) : (
          <div className="empty-state" style={{ padding: '32px 20px' }}>
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-text">
              {selectedDate === getTodayKey()
                ? '오늘 아직 루틴 기록이 없습니다'
                : '이 날의 기록이 없습니다'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RecordDetail({ record, dateKey, onUpdate }) {
  const [editingKey, setEditingKey] = useState(null)

  const rate = calculatePracticeRate(record)
  const rateColor = rate >= 75 ? '#00B894' : rate >= 50 ? '#FDCB6E' : '#FF7675'

  const fmt = (t) => {
    if (!t) return '-'
    const [h, m] = t.split(':').map(Number)
    const p = h < 12 ? '오전' : '오후'
    const hh = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${p} ${hh}:${String(m).padStart(2, '0')}`
  }

  const handleEdit = (periodId, newStatus) => {
    if (newStatus === null) {
      clearRoutineAction(dateKey, periodId)
    } else {
      saveRoutineAction(dateKey, periodId, newStatus)
    }
    setEditingKey(null)
    onUpdate()
  }

  // Detect test mode by checking for test_ routines
  const testRoutineEntries = Object.entries(record.routines || {})
    .filter(([k]) => k.startsWith('test_'))
    .sort(([a], [b]) => a.localeCompare(b))
  const hasTestRoutines = testRoutineEntries.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Rate */}
      <div className="card card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: `${rateColor}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 800, color: rateColor,
        }}>
          {rate}%
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>실천율</div>
          <div style={{ fontSize: 13, color: '#A0A0B8', marginTop: 2 }}>
            {rate === 100 ? '완벽한 하루!' : rate >= 75 ? '좋은 하루!' : rate >= 50 ? '괜찮은 하루' : '더 노력해요'}
          </div>
        </div>
      </div>

      {/* Hourly test alarms (if any) */}
      {hasTestRoutines && (
        <div className="card card-body">
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6E8A', marginBottom: 12 }}>⏰ 시간별 알람 실천</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {testRoutineEntries.map(([k, v]) => {
              const hk = k.replace('test_', '')
              const h = parseInt(hk, 10)
              const dh = h === 0 ? 12 : h > 12 ? h - 12 : h
              const timeLabel = `${h < 12 ? '오전' : '오후'} ${dh}:00`
              const behavior = TEST_HOURLY_BEHAVIORS[hk]
              const status = v?.status || null
              const isEditing = editingKey === k
              return (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{timeLabel}</div>
                    {behavior && <div style={{ fontSize: 11, color: '#A0A0B8' }}>{behavior.title}</div>}
                  </div>
                  {!isEditing ? (
                    <button
                      onClick={() => setEditingKey(k)}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                        background: status === 'done' ? '#E6FBF5' : status === 'skipped' ? '#FFF8E6' : status === 'missed' ? '#FFF0F0' : '#F5F5F5',
                        color: status === 'done' ? '#00B894' : status === 'skipped' ? '#E67E22' : status === 'missed' ? '#FF7675' : '#CCC',
                      }}
                    >
                      {status === 'done' ? '✅ 완료' : status === 'skipped' ? '⏭ 건너뜀' : status === 'missed' ? '❌ 미실행' : '— 기록 없음'} ✏️
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button className="btn btn-primary btn-sm" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => handleEdit(k, 'done')}>완료 ✓</button>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 11, background: '#FFF8E6', color: '#E67E22' }} onClick={() => handleEdit(k, 'skipped')}>건너뜀</button>
                      {status && <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => handleEdit(k, null)}>삭제</button>}
                      <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setEditingKey(null)}>취소</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Regular routine completions (if no test routines) */}
      {!hasTestRoutines && (
        <div className="card card-body">
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6E8A', marginBottom: 12 }}>루틴 실천</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PERIOD_ORDER.map(pid => {
              const p = ALARM_PERIODS[pid]
              const status = record.routines?.[pid]?.status || null
              const isEditing = editingKey === pid
              return (
                <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: p.gradient,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                  }}>
                    {p.icon}
                  </div>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                  {!isEditing ? (
                    <button
                      onClick={() => setEditingKey(pid)}
                      style={{
                        fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                        background: status === 'done' ? '#E6FBF5' : status === 'skipped' ? '#FFF8E6' : status === 'missed' ? '#FFF0F0' : '#F5F5F5',
                        color: status === 'done' ? '#00B894' : status === 'skipped' ? '#E67E22' : status === 'missed' ? '#FF7675' : '#CCC',
                      }}
                    >
                      {status === 'done' ? '✅ 완료' : status === 'skipped' ? '⏭ 건너뜀' : status === 'missed' ? '❌ 미실행' : '— 기록 없음'} ✏️
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button className="btn btn-primary btn-sm" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => handleEdit(pid, 'done')}>완료 ✓</button>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 11, background: '#FFF8E6', color: '#E67E22' }} onClick={() => handleEdit(pid, 'skipped')}>건너뜀</button>
                      {status && <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => handleEdit(pid, null)}>삭제</button>}
                      <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setEditingKey(null)}>취소</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Sleep (only if checkin completed) */}
      {record.completed && (
        <div className="card card-body">
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6E8A', marginBottom: 12 }}>💤 모닝 체크인 (참고 정보)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Stat label="취침" value={fmt(record.sleepTime)} />
            <Stat label="기상" value={fmt(record.wakeTime)} color={record.wakeOnTime ? '#00B894' : '#FF7675'} />
            <Stat label="수면" value={`${record.sleepHours || 0}h`} />
          </div>
          {record.sleepQuality > 0 && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#A0A0B8' }}>수면 질:</span>
              <span style={{ fontSize: 14 }}>{'⭐'.repeat(record.sleepQuality)}</span>
            </div>
          )}
          {record.exercise && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>💪</span>
              <span style={{ fontSize: 13, color: '#00B894', fontWeight: 600 }}>
                운동 완료
                {record.exerciseDuration ? ` · ${record.exerciseDuration}` : ''}
                {record.exerciseStart ? ` (${fmt(record.exerciseStart)} 시작)` : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || '#1E1E2E' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#A0A0B8', marginTop: 2 }}>{label}</div>
    </div>
  )
}
