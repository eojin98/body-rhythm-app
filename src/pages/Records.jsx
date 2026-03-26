import { useState } from 'react'
import { getRecords, calculatePracticeRate, DAY_NAMES, getTodayKey } from '../utils/storage'
import { ALARM_PERIODS, PERIOD_ORDER } from '../utils/alarmContent'

export default function Records() {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(getTodayKey())

  const records = getRecords()

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

  return (
    <div className="page fade-up">
      {/* Header */}
      <div className="page-header">
        <div className="header-title">기록</div>
        <div className="header-sub">날짜별 실천 기록을 확인하세요</div>
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
              const dotColor = rec?.completed ? getRateColor(rate) : null
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
          <RecordDetail record={selectedRecord} />
        ) : (
          <div className="empty-state" style={{ padding: '32px 20px' }}>
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-text">이 날의 체크인 기록이 없습니다</div>
          </div>
        )}
      </div>
    </div>
  )
}

function RecordDetail({ record }) {
  const rate = calculatePracticeRate(record)
  const rateColor = rate >= 75 ? '#00B894' : rate >= 50 ? '#FDCB6E' : '#FF7675'

  const fmt = (t) => {
    if (!t) return '-'
    const [h, m] = t.split(':').map(Number)
    const p = h < 12 ? '오전' : '오후'
    const hh = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${p} ${hh}:${String(m).padStart(2, '0')}`
  }

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

      {/* Routine completions */}
      <div className="card card-body">
        <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6E8A', marginBottom: 12 }}>루틴 실천</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PERIOD_ORDER.map(pid => {
            const p = ALARM_PERIODS[pid]
            const status = record.routines?.[pid]?.status || null
            return (
              <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: p.gradient,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}>
                  {p.icon}
                </div>
                <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                <div style={{
                  fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                  background: status === 'done' ? '#E6FBF5' : status === 'skipped' ? '#FFF8E6' : '#F5F5F5',
                  color: status === 'done' ? '#00B894' : status === 'skipped' ? '#E67E22' : '#CCC',
                }}>
                  {status === 'done' ? '✅ 완료' : status === 'skipped' ? '⏭ 건너뜀' : '— 기록 없음'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Sleep (only if checkin completed) */}
      {record.completed && (
        <div className="card card-body">
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6E8A', marginBottom: 12 }}>수면 (모닝 체크인)</div>
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
