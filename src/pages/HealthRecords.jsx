import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRecords, DAY_NAMES, getLastWeekDates } from '../utils/storage'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function getExerciseMins(rec) {
  if (!rec?.exercise) return 0
  if (typeof rec.exerciseDurationMins === 'number') return rec.exerciseDurationMins
  if (typeof rec.exerciseDuration === 'string') {
    let total = 0
    const hourMatch = rec.exerciseDuration.match(/(\d+)\s*시간/)
    const minMatch = rec.exerciseDuration.match(/(\d+)\s*분/)
    if (hourMatch) total += parseInt(hourMatch[1], 10) * 60
    if (minMatch) total += parseInt(minMatch[1], 10)
    if (total > 0) return total
  }
  return 0
}

function formatExerciseDuration(rec) {
  if (typeof rec.exerciseDurationMins === 'number' && rec.exerciseDurationMins > 0) {
    const h = Math.floor(rec.exerciseDurationMins / 60)
    const m = rec.exerciseDurationMins % 60
    if (h === 0) return `${m}분`
    if (m === 0) return `${h}시간`
    return `${h}시간 ${m}분`
  }
  return rec.exerciseDuration || ''
}

const FILTERS = [
  { label: '최근 7일', days: 7 },
  { label: '최근 30일', days: 30 },
  { label: '전체', days: null },
]

// Derive sleepDate/wakeDate — supports both new records (with explicit dates) and old ones (migration)
function getSleepWakeDates(dateKey, record) {
  const wakeDate = record.wakeDate || dateKey
  if (record.sleepDate) return { sleepDate: record.sleepDate, wakeDate }
  // Migration: infer sleepDate from sleepTime
  const [sh] = (record.sleepTime || '23:00').split(':').map(Number)
  let sleepDate
  if (sh >= 12) {
    // Sleep was evening/night → previous calendar day
    const [y, mo, d] = wakeDate.split('-').map(Number)
    const prev = new Date(y, mo - 1, d)
    prev.setDate(prev.getDate() - 1)
    sleepDate = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`
  } else {
    sleepDate = wakeDate
  }
  return { sleepDate, wakeDate }
}

// "밤" / "새벽" / "오전" / "오후" label by hour
function timePeriod(h) {
  if (h >= 18) return '밤'
  if (h >= 12) return '오후'
  if (h >= 6) return '오전'
  return '새벽'
}

// "4월 7일(화) 밤 11:30"
function formatDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return ''
  const [y, mo, d] = dateStr.split('-').map(Number)
  const date = new Date(y, mo - 1, d)
  const dayName = DAY_NAMES[date.getDay()]
  const [h, m] = timeStr.split(':').map(Number)
  const period = timePeriod(h)
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${mo}월 ${d}일(${dayName}) ${period} ${hour12}:${String(m).padStart(2, '0')}`
}

// "7시간 40분" from decimal hours
function formatDuration(hours) {
  if (!hours) return ''
  const totalMins = Math.round(hours * 60)
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  if (m === 0) return `${h}시간`
  return `${h}시간 ${m}분`
}

// "오전 7:10" from HH:MM 24h string
function fmt12(timeStr) {
  if (!timeStr) return '-'
  const [h, m] = timeStr.split(':').map(Number)
  const period = h < 12 ? '오전' : '오후'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${period} ${hour12}:${String(m).padStart(2, '0')}`
}

const MEAL_LABELS = [
  { key: 'breakfast', label: '아침', icon: '🍳' },
  { key: 'lunch',     label: '점심', icon: '🥗' },
  { key: 'dinner',    label: '저녁', icon: '🍚' },
  { key: 'latenight', label: '야식', icon: '🌙' },
]

export default function HealthRecords() {
  const navigate = useNavigate()
  const [filterIdx, setFilterIdx] = useState(0)
  const [records, setRecords] = useState({})

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
  }, [refresh])

  const maxDays = FILTERS[filterIdx].days
  const now = new Date()

  const filteredDates = Object.keys(records)
    .filter(date => {
      const rec = records[date]
      if (!rec?.completed) return false
      if (!maxDays) return true
      const [y, mo, d] = date.split('-').map(Number)
      const diffMs = now - new Date(y, mo - 1, d)
      return diffMs / (1000 * 60 * 60 * 24) < maxDays
    })
    .sort((a, b) => b.localeCompare(a)) // newest first

  return (
    <div className="page fade-up">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/records')}
            style={{
              background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10,
              color: 'white', padding: '8px 12px', cursor: 'pointer', fontSize: 15,
              userSelect: 'none',
            }}
          >
            ←
          </button>
          <div>
            <div className="header-title">건강 기록</div>
            <div className="header-sub">수면 · 식사 · 운동 이력</div>
          </div>
        </div>
      </div>

      {/* Exercise chart */}
      <ExerciseChart records={records} />

      {/* Filter tabs */}
      <div className="section">
        <div style={{ display: 'flex', gap: 8 }}>
          {FILTERS.map(({ label }, i) => (
            <button
              key={label}
              onClick={() => setFilterIdx(i)}
              style={{
                padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: filterIdx === i ? '#6C5CE7' : '#F0EFF8',
                color: filterIdx === i ? 'white' : '#6E6E8A',
                fontWeight: filterIdx === i ? 700 : 500, fontSize: 14,
                transition: 'all 0.2s', userSelect: 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Count badge */}
      {filteredDates.length > 0 && (
        <div style={{ padding: '0 16px', marginTop: 10 }}>
          <span style={{ fontSize: 13, color: '#A0A0B8' }}>총 {filteredDates.length}일 기록</span>
        </div>
      )}

      {/* Cards */}
      <div style={{ padding: '0 16px', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 32 }}>
        {filteredDates.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-text">
              {maxDays
                ? `최근 ${maxDays}일 동안 기록된 체크인이 없습니다`
                : '아직 기록된 체크인이 없습니다'}
            </div>
          </div>
        ) : (
          filteredDates.map(date => (
            <HealthCard key={date} date={date} record={records[date]} />
          ))
        )}
      </div>
    </div>
  )
}

function HealthCard({ date, record }) {
  const { sleepDate, wakeDate } = getSleepWakeDates(date, record)

  const sleepFrom = record.sleepTime ? formatDateTime(sleepDate, record.sleepTime) : null
  const sleepTo   = record.wakeTime  ? formatDateTime(wakeDate,  record.wakeTime)  : null
  const duration  = formatDuration(record.sleepHours)

  return (
    <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Date header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#6C5CE7' }}>
          {(() => {
            const [y, mo, d] = date.split('-').map(Number)
            const dateObj = new Date(y, mo - 1, d)
            return `${mo}월 ${d}일(${DAY_NAMES[dateObj.getDay()]})`
          })()}
        </span>
        {record.sleepQuality > 0 && (
          <span style={{ fontSize: 13 }}>{'⭐'.repeat(record.sleepQuality)}</span>
        )}
      </div>

      {/* Sleep */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#A0A0B8', marginBottom: 5 }}>💤 수면</div>
        {sleepFrom && sleepTo ? (
          <div style={{ fontSize: 14, color: '#1E1E2E', lineHeight: 1.6 }}>
            <span>{sleepFrom}</span>
            <span style={{ color: '#A0A0B8', margin: '0 4px' }}>→</span>
            <span>{sleepTo}</span>
            {duration && (
              <span style={{
                marginLeft: 8, fontSize: 13, fontWeight: 700,
                color: '#6C5CE7', background: '#F5F4FF',
                padding: '2px 8px', borderRadius: 8,
              }}>
                {duration}
              </span>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 14, color: '#CCC' }}>기록 없음</div>
        )}
      </div>

      <div style={{ height: 1, background: '#F0EFF8' }} />

      {/* Meals */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#A0A0B8', marginBottom: 8 }}>🍽 식사</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {MEAL_LABELS.map(({ key, label, icon }) => {
            const meal = record.meals?.[key]
            let mealTime = '-'
            if (meal) {
              if (typeof meal === 'boolean') {
                mealTime = meal ? '먹음' : '-'
              } else if (!meal.skipped && meal.time) {
                mealTime = fmt12(meal.time)
              }
            }
            const hasTime = mealTime !== '-'
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: 11, color: '#A0A0B8', fontWeight: 500 }}>{label}</div>
                  <div style={{
                    fontSize: 13, fontWeight: hasTime ? 600 : 400,
                    color: hasTime ? '#1E1E2E' : '#D0CFE8',
                  }}>
                    {mealTime}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ height: 1, background: '#F0EFF8' }} />

      {/* Exercise */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{record.exercise ? '💪' : '🛋️'}</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#A0A0B8' }}>운동</div>
          {record.exercise ? (
            <div style={{ fontSize: 13, fontWeight: 600, color: '#00B894' }}>
              {formatExerciseDuration(record) || '완료'}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#A0A0B8' }}>휴식</div>
          )}
        </div>
      </div>
    </div>
  )
}

function ExerciseChart({ records }) {
  const weekDates = getLastWeekDates()

  const data = weekDates.map(({ key, date }) => ({
    label: `${date.getMonth() + 1}/${date.getDate()}`,
    mins: getExerciseMins(records[key]),
  }))

  const totalMins = data.reduce((s, d) => s + d.mins, 0)
  const totalH = Math.floor(totalMins / 60)
  const totalM = totalMins % 60
  const totalText = totalH > 0
    ? (totalM > 0 ? `${totalH}시간 ${totalM}분` : `${totalH}시간`)
    : `${totalM}분`

  return (
    <div className="section">
      <div className="section-title">이번 주 운동 시간</div>
      <div className="card card-body">
        <div style={{ fontSize: 13, color: '#A0A0B8', marginBottom: 12 }}>
          이번 주 총{' '}
          <span style={{ color: '#6C5CE7', fontWeight: 700 }}>{totalText}</span>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0EFF8" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#A0A0B8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#A0A0B8' }} axisLine={false} tickLine={false} unit="분" />
            <Tooltip
              formatter={(v) => [`${v}분`, '운동']}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E0DFFF' }}
            />
            <Bar dataKey="mins" fill="#6C5CE7" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
