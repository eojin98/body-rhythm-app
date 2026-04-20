import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getRecords, calculatePracticeRate, saveRoutineAction, clearRoutineAction,
  DAY_NAMES, getTodayKey,
} from '../utils/storage'
import { ALARM_PERIODS, PERIOD_ORDER, TEST_HOURLY_BEHAVIORS } from '../utils/alarmContent'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

// ─── Date helpers ────────────────────────────────────────────────────────────

function dateToKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Monday-based week start
function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekDates(weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
}

const DAY_LABELS_MON = ['월', '화', '수', '목', '금', '토', '일']

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmtDayNav(date) {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  const day = DAY_NAMES[date.getDay()]
  return `${y}년 ${m}월 ${d}일 (${day})`
}

function fmtWeekNav(weekStart) {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  const y1 = weekStart.getFullYear(), m1 = weekStart.getMonth() + 1, d1 = weekStart.getDate()
  const y2 = weekEnd.getFullYear(), m2 = weekEnd.getMonth() + 1, d2 = weekEnd.getDate()
  if (y1 === y2 && m1 === m2) return `${y1}년 ${m1}월 ${d1}일~${d2}일`
  if (y1 === y2) return `${y1}년 ${m1}월 ${d1}일~${m2}월 ${d2}일`
  return `${y1}년 ${m1}월 ${d1}일~${y2}년 ${m2}월 ${d2}일`
}

function fmtMonthNav(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`
}

function fmt12(t) {
  if (!t) return '-'
  const [h, m] = t.split(':').map(Number)
  const p = h < 12 ? '오전' : '오후'
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${p} ${hh}:${String(m).padStart(2, '0')}`
}

function fmtDuration(mins) {
  if (!mins || mins <= 0) return null
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}시간 ${m}분`
  if (h > 0) return `${h}시간`
  return `${m}분`
}

function getRateColor(rate) {
  if (rate === null || rate === undefined || rate === 0) return '#EEEEEE'
  if (rate < 50) return '#FF7675'
  if (rate < 75) return '#FDCB6E'
  return '#00B894'
}

// ─── Main Records component ───────────────────────────────────────────────────

export default function Records() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('day')
  const [viewDate, setViewDate] = useState(() => new Date())
  const [showPicker, setShowPicker] = useState(false)
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

  const todayKey = getTodayKey()

  const shiftDate = (direction) => {
    setViewDate(prev => {
      const d = new Date(prev)
      if (tab === 'day') d.setDate(d.getDate() + direction)
      else if (tab === 'week') d.setDate(d.getDate() + direction * 7)
      else d.setMonth(d.getMonth() + direction)
      return d
    })
  }

  const navLabel = useMemo(() => {
    if (tab === 'day') return fmtDayNav(viewDate)
    if (tab === 'week') return fmtWeekNav(getWeekStart(viewDate))
    return fmtMonthNav(viewDate)
  }, [tab, viewDate])

  const isFuture = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    if (tab === 'day') {
      const d = new Date(viewDate); d.setHours(0, 0, 0, 0)
      return d > today
    }
    if (tab === 'week') {
      const ws = getWeekStart(viewDate); const todayWs = getWeekStart(today)
      return ws > todayWs
    }
    return viewDate.getFullYear() > today.getFullYear() ||
      (viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() > today.getMonth())
  }, [tab, viewDate])

  return (
    <div className="page fade-up">
      {/* Header */}
      <div className="page-header">
        <div className="header-title">기록</div>
        <div className="header-sub">날짜별 실천 기록을 확인하세요</div>
      </div>

      {/* Tabs */}
      <div className="section" style={{ paddingBottom: 0 }}>
        <div style={{ display: 'flex', background: '#F5F5FA', borderRadius: 12, padding: 4, gap: 2 }}>
          {[['day', '일'], ['week', '주'], ['month', '월']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontWeight: tab === key ? 700 : 500, fontSize: 14,
                background: tab === key ? 'white' : 'transparent',
                color: tab === key ? '#6C5CE7' : '#A0A0B8',
                boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                transition: 'all 0.18s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Date navigator */}
      <div className="section" style={{ paddingTop: 10, paddingBottom: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'white', borderRadius: 14, padding: '8px 4px',
          boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
        }}>
          <button
            onClick={() => shiftDate(-1)}
            style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6C5CE7', padding: '4px 12px', lineHeight: 1 }}
          >
            ‹
          </button>
          <button
            onClick={() => setShowPicker(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', flex: 1, padding: '2px 0' }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1E1E2E', textAlign: 'center' }}>{navLabel}</div>
            <div style={{ fontSize: 11, color: '#B0B0C8', marginTop: 2, textAlign: 'center' }}>탭하여 날짜 선택</div>
          </button>
          <button
            onClick={() => shiftDate(1)}
            disabled={isFuture}
            style={{
              background: 'none', border: 'none', fontSize: 24, cursor: isFuture ? 'default' : 'pointer',
              color: isFuture ? '#DDD' : '#6C5CE7', padding: '4px 12px', lineHeight: 1,
            }}
          >
            ›
          </button>
        </div>
      </div>

      {/* Tab content */}
      {tab === 'day' && (
        <DayView date={viewDate} records={records} todayKey={todayKey} onUpdate={refresh} />
      )}
      {tab === 'week' && (
        <WeekView
          date={viewDate} records={records} todayKey={todayKey}
          onGoToDay={(d) => { setViewDate(d); setTab('day') }}
        />
      )}
      {tab === 'month' && (
        <MonthView
          date={viewDate} records={records} todayKey={todayKey}
          onGoToDay={(d) => { setViewDate(d); setTab('day') }}
        />
      )}

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

      {/* Date picker modal */}
      {showPicker && (
        <DatePickerModal
          value={viewDate}
          tab={tab}
          onSelect={(d) => { setViewDate(d); setShowPicker(false) }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({ date, records, todayKey, onUpdate }) {
  const key = dateToKey(date)
  const record = records[key] || null
  const isToday = key === todayKey

  if (!record) {
    return (
      <div className="section">
        <div className="empty-state" style={{ padding: '40px 20px' }}>
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-text">
            {isToday ? '오늘 아직 루틴 기록이 없습니다' : '이 날의 기록이 없습니다'}
          </div>
        </div>
      </div>
    )
  }

  return <RecordDetail record={record} dateKey={key} onUpdate={onUpdate} />
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({ date, records, todayKey, onGoToDay }) {
  const weekStart = getWeekStart(date)
  const weekDates = getWeekDates(weekStart)
  const weekKeys = weekDates.map(dateToKey)
  const weekRecords = weekKeys.map(k => records[k] || null)
  const weekRates = weekRecords.map(r => (r ? calculatePracticeRate(r) : null))

  const recordedDays = weekRecords.filter(Boolean)
  const checkinDays = recordedDays.filter(r => r.completed)

  const avgRate = recordedDays.length > 0
    ? Math.round(recordedDays.reduce((s, r) => s + calculatePracticeRate(r), 0) / recordedDays.length)
    : null

  const avgSleep = checkinDays.length > 0
    ? (checkinDays.reduce((s, r) => s + (r.sleepHours || 0), 0) / checkinDays.length).toFixed(1)
    : null

  const totalExercise = recordedDays.reduce((s, r) => {
    if (r.exercise && typeof r.exerciseDurationMins === 'number') return s + r.exerciseDurationMins
    return s
  }, 0)

  const maxRate = Math.max(1, ...weekRates.filter(r => r !== null))

  return (
    <div>
      {/* Bar chart */}
      <div className="section" style={{ paddingTop: 12, paddingBottom: 0 }}>
        <div className="card card-body">
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6E8A', marginBottom: 14 }}>요일별 실천율</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110 }}>
            {weekDates.map((d, i) => {
              const key = weekKeys[i]
              const rate = weekRates[i]
              const isToday = key === todayKey
              const barPct = rate !== null ? Math.max(6, Math.round((rate / maxRate) * 84)) : 6
              const color = getRateColor(rate)
              return (
                <div
                  key={i}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}
                  onClick={() => onGoToDay(d)}
                >
                  <div style={{ fontSize: 10, color: rate !== null ? color : 'transparent', fontWeight: 700, minHeight: 14 }}>
                    {rate !== null ? `${rate}%` : ''}
                  </div>
                  <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', height: 80 }}>
                    <div
                      style={{
                        width: '100%', borderRadius: '5px 5px 0 0',
                        height: `${barPct}%`, minHeight: 4,
                        background: isToday && rate === null ? '#E8E5FF' : color,
                        border: isToday ? '2px solid #6C5CE7' : 'none',
                        boxSizing: 'border-box',
                        transition: 'height 0.3s',
                      }}
                    />
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: isToday ? 700 : 400,
                    color: isToday ? '#6C5CE7' : '#A0A0B8',
                  }}>
                    {DAY_LABELS_MON[i]}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 10 }}>
            {[['#00B894', '75%+'], ['#FDCB6E', '50%+'], ['#FF7675', '50% 미만']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
                <span style={{ fontSize: 10, color: '#A0A0B8' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="section" style={{ paddingTop: 10, paddingBottom: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <SummaryCard icon="📊" label="평균 실천율" value={avgRate !== null ? `${avgRate}%` : '-'} color="#6C5CE7" />
          <SummaryCard icon="💤" label="평균 수면" value={avgSleep ? `${avgSleep}h` : '-'} color="#4A90E2" />
          <SummaryCard icon="💪" label="총 운동" value={fmtDuration(totalExercise) || '-'} color="#00B894" />
        </div>
      </div>

      {/* 7 mini day cards */}
      <div className="section" style={{ paddingTop: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {weekDates.map((d, i) => (
            <MiniDayCard
              key={weekKeys[i]}
              date={d}
              dayLabel={DAY_LABELS_MON[i]}
              record={weekRecords[i]}
              rate={weekRates[i]}
              isToday={weekKeys[i] === todayKey}
              onClick={() => onGoToDay(d)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({ date, records, todayKey, onGoToDay }) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const dk = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const monthRecords = []
  for (let d = 1; d <= daysInMonth; d++) {
    const r = records[dk(d)]
    if (r) monthRecords.push(r)
  }

  const checkinDays = monthRecords.filter(r => r.completed)
  const avgSleep = checkinDays.length > 0
    ? (checkinDays.reduce((s, r) => s + (r.sleepHours || 0), 0) / checkinDays.length).toFixed(1)
    : null
  const totalExercise = monthRecords.reduce((s, r) => {
    if (r.exercise && typeof r.exerciseDurationMins === 'number') return s + r.exerciseDurationMins
    return s
  }, 0)
  const ratedDays = monthRecords.filter(r => calculatePracticeRate(r) > 0)
  const avgRate = ratedDays.length > 0
    ? Math.round(ratedDays.reduce((s, r) => s + calculatePracticeRate(r), 0) / ratedDays.length)
    : null

  // Sleep line chart
  const sleepData = []
  for (let d = 1; d <= daysInMonth; d++) {
    const r = records[dk(d)]
    if (r?.completed && r.sleepHours) sleepData.push({ day: d, hours: r.sleepHours })
  }

  return (
    <div>
      {/* Calendar */}
      <div className="section" style={{ paddingTop: 12, paddingBottom: 0 }}>
        <div className="card card-body">
          <div className="calendar-grid" style={{ marginBottom: 6 }}>
            {DAY_NAMES.map((d, i) => (
              <div key={d} className="cal-day-header" style={{ color: i === 0 ? '#FF7675' : i === 6 ? '#6C5CE7' : undefined }}>
                {d}
              </div>
            ))}
          </div>
          <div className="calendar-grid">
            {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = i + 1
              const key = dk(d)
              const rec = records[key]
              const rate = rec ? calculatePracticeRate(rec) : 0
              const isToday = key === todayKey
              const dotColor = rate > 0 ? getRateColor(rate) : null
              const dow = new Date(year, month, d).getDay()
              return (
                <div
                  key={d}
                  className={`cal-day${isToday ? ' today' : ''}`}
                  onClick={() => onGoToDay(new Date(year, month, d))}
                  style={{
                    color: isToday ? undefined : dow === 0 ? '#FF7675' : dow === 6 ? '#6C5CE7' : undefined,
                    fontWeight: isToday ? 700 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {d}
                  {dotColor && <div className="dot" style={{ background: dotColor }} />}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 12 }}>
            {[['#00B894', '75%+'], ['#FDCB6E', '50%+'], ['#FF7675', '50% 미만']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
                <span style={{ fontSize: 10, color: '#A0A0B8' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly stats */}
      <div className="section" style={{ paddingTop: 10, paddingBottom: 0 }}>
        <div className="section-title">월간 통계</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <SummaryCard icon="📊" label="평균 실천율" value={avgRate !== null ? `${avgRate}%` : '-'} color="#6C5CE7" />
          <SummaryCard icon="💤" label="평균 수면" value={avgSleep ? `${avgSleep}h` : '-'} color="#4A90E2" />
          <SummaryCard icon="💪" label="총 운동" value={fmtDuration(totalExercise) || '-'} color="#00B894" />
        </div>
      </div>

      {/* Sleep line chart */}
      {sleepData.length > 1 && (
        <div className="section" style={{ paddingTop: 10 }}>
          <div className="section-title">월간 수면시간</div>
          <div className="card card-body">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={sleepData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F5" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#A0A0B8' }} tickFormatter={v => `${v}일`} />
                <YAxis domain={[0, 12]} tick={{ fontSize: 10, fill: '#A0A0B8' }} tickFormatter={v => `${v}h`} />
                <Tooltip
                  formatter={(v) => [`${v}h`, '수면시간']}
                  labelFormatter={(d) => `${month + 1}월 ${d}일`}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Line
                  type="monotone" dataKey="hours" stroke="#4A90E2" strokeWidth={2}
                  dot={{ r: 3, fill: '#4A90E2' }} activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Record Detail (Day view body) ────────────────────────────────────────────

function RecordDetail({ record, dateKey, onUpdate }) {
  const [editingKey, setEditingKey] = useState(null)

  const rate = calculatePracticeRate(record)
  const rateColor = rate >= 75 ? '#00B894' : rate >= 50 ? '#FDCB6E' : '#FF7675'

  const routines = record.routines || {}
  const allStatuses = Object.values(routines).map(v => v?.status).filter(Boolean)
  const doneCount = allStatuses.filter(s => s === 'done').length
  const skippedCount = allStatuses.filter(s => s === 'skipped').length
  const missedCount = allStatuses.filter(s => s === 'missed').length

  const testEntries = Object.entries(routines)
    .filter(([k]) => k.startsWith('test_'))
    .sort(([a], [b]) => a.localeCompare(b))
  const hasTest = testEntries.length > 0

  const handleEdit = (id, status) => {
    if (status === null) clearRoutineAction(dateKey, id)
    else saveRoutineAction(dateKey, id, status)
    setEditingKey(null)
    onUpdate()
  }

  return (
    <div>
      {/* Practice rate + action counts */}
      <div className="section" style={{ paddingTop: 12, paddingBottom: 0 }}>
        <div className="card card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%', flexShrink: 0,
              background: rate > 0 ? `${rateColor}22` : '#F5F5FA',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 800, color: rate > 0 ? rateColor : '#CCC',
            }}>
              {rate > 0 ? `${rate}%` : '—'}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>알람 실천율</div>
              <div style={{ fontSize: 13, color: '#A0A0B8', marginTop: 3 }}>
                {rate === 100 ? '완벽한 하루!' : rate >= 75 ? '잘 했어요!' : rate >= 50 ? '괜찮은 하루' : rate > 0 ? '더 노력해봐요' : '아직 기록 없음'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: '완료', count: doneCount, color: '#00B894', bg: '#E6FBF5' },
              { label: '건너뜀', count: skippedCount, color: '#E67E22', bg: '#FFF8E6' },
              { label: '미실행', count: missedCount, color: '#FF7675', bg: '#FFF0F0' },
            ].map(({ label, count, color, bg }) => (
              <div key={label} style={{ flex: 1, textAlign: 'center', padding: '10px 4px', borderRadius: 10, background: bg }}>
                <div style={{ fontSize: 20, fontWeight: 700, color }}>{count}</div>
                <div style={{ fontSize: 11, color, marginTop: 1 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sleep */}
      {record.completed && (
        <div className="section" style={{ paddingTop: 10, paddingBottom: 0 }}>
          <div className="card card-body">
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6E8A', marginBottom: 12 }}>💤 수면</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{fmt12(record.sleepTime)}</span>
              <span style={{ fontSize: 13, color: '#B0B0C8' }}>→</span>
              <span style={{
                fontSize: 14, fontWeight: 600,
                color: record.wakeOnTime ? '#00B894' : '#FF7675',
              }}>
                {fmt12(record.wakeTime)}
              </span>
              <span style={{ fontSize: 12, color: '#B0B0C8' }}>
                {record.wakeOnTime ? '(정시 기상)' : '(늦은 기상)'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 13, color: '#A0A0B8' }}>총 수면시간 </span>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{record.sleepHours}h</span>
              </div>
              {record.sleepQuality > 0 && (
                <div>
                  <span style={{ fontSize: 12, color: '#A0A0B8' }}>수면 질 </span>
                  <span style={{ fontSize: 14 }}>{'⭐'.repeat(record.sleepQuality)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Meals */}
      {record.completed && record.meals && (
        <div className="section" style={{ paddingTop: 10, paddingBottom: 0 }}>
          <div className="card card-body">
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6E8A', marginBottom: 12 }}>🍽️ 식사</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { key: 'breakfast', label: '아침', icon: '🌅' },
                { key: 'lunch',     label: '점심', icon: '☀️' },
                { key: 'dinner',    label: '저녁', icon: '🌆' },
                { key: 'latenight', label: '야식', icon: '🌙' },
              ].map(({ key, label, icon }) => {
                const meal = record.meals[key]
                const eaten = meal != null && (typeof meal === 'boolean' ? meal : !meal.skipped)
                const time = eaten && meal && typeof meal === 'object' ? meal.time : null
                return (
                  <div
                    key={key}
                    style={{
                      padding: '10px 12px', borderRadius: 12,
                      background: eaten ? '#F0FBF7' : '#F5F5FA',
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#A0A0B8', marginBottom: 4 }}>{icon} {label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: eaten ? '#00B894' : '#C0C0D0' }}>
                      {eaten ? (time ? fmt12(time) : '먹음') : '-'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Exercise */}
      {record.completed && (
        <div className="section" style={{ paddingTop: 10, paddingBottom: 0 }}>
          <div className="card card-body" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 30 }}>{record.exercise ? '💪' : '🛋️'}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{record.exercise ? '운동 완료' : '휴식'}</div>
              {record.exercise && (
                <div style={{ fontSize: 13, color: '#00B894', marginTop: 3, fontWeight: 600 }}>
                  {typeof record.exerciseDurationMins === 'number' && record.exerciseDurationMins > 0
                    ? fmtDuration(record.exerciseDurationMins)
                    : record.exerciseDuration || null}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Routine list */}
      <div className="section" style={{ paddingTop: 10 }}>
        <div className="card card-body">
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6E8A', marginBottom: 12 }}>
            {hasTest ? '⏰ 시간별 알람 실천' : '루틴 실천'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hasTest
              ? testEntries.map(([k, v]) => {
                  const hk = k.replace('test_', '')
                  const h = parseInt(hk, 10)
                  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h
                  return (
                    <RoutineRow
                      key={k}
                      label={`${h < 12 ? '오전' : '오후'} ${dh}:00`}
                      sublabel={TEST_HOURLY_BEHAVIORS[hk]?.title}
                      status={v?.status || null}
                      isEditing={editingKey === k}
                      onEdit={() => setEditingKey(k)}
                      onSave={(s) => handleEdit(k, s)}
                      onCancel={() => setEditingKey(null)}
                    />
                  )
                })
              : PERIOD_ORDER.map(pid => {
                  const p = ALARM_PERIODS[pid]
                  return (
                    <RoutineRow
                      key={pid}
                      icon={p.icon}
                      iconGradient={p.gradient}
                      label={p.name}
                      status={record.routines?.[pid]?.status || null}
                      isEditing={editingKey === pid}
                      onEdit={() => setEditingKey(pid)}
                      onSave={(s) => handleEdit(pid, s)}
                      onCancel={() => setEditingKey(null)}
                    />
                  )
                })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RoutineRow({ icon, iconGradient, label, sublabel, status, isEditing, onEdit, onSave, onCancel }) {
  const cfg = {
    done:    { bg: '#E6FBF5', color: '#00B894', text: '✅ 완료' },
    skipped: { bg: '#FFF8E6', color: '#E67E22', text: '⏭ 건너뜀' },
    missed:  { bg: '#FFF0F0', color: '#FF7675', text: '❌ 미실행' },
  }[status] || { bg: '#F5F5F5', color: '#C0C0D0', text: '— 기록 없음' }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {iconGradient && (
        <div style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          background: iconGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
        }}>
          {icon}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        {sublabel && <div style={{ fontSize: 11, color: '#A0A0B8' }}>{sublabel}</div>}
      </div>
      {!isEditing ? (
        <button
          onClick={onEdit}
          style={{
            fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, border: 'none',
            cursor: 'pointer', background: cfg.bg, color: cfg.color,
          }}
        >
          {cfg.text} ✏️
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => onSave('done')}>완료</button>
          <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 11, background: '#FFF8E6', color: '#E67E22' }} onClick={() => onSave('skipped')}>건너뜀</button>
          {status && <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => onSave(null)}>삭제</button>}
          <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 11 }} onClick={onCancel}>취소</button>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ icon, label, value, color }) {
  return (
    <div className="card card-body" style={{ textAlign: 'center', padding: '14px 8px' }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || '#1E1E2E' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#A0A0B8', marginTop: 3 }}>{label}</div>
    </div>
  )
}

function MiniDayCard({ date, dayLabel, record, rate, isToday, onClick }) {
  const rateColor = getRateColor(rate)
  const exerciseDuration = record?.exercise && typeof record.exerciseDurationMins === 'number'
    ? fmtDuration(record.exerciseDurationMins)
    : null

  return (
    <div
      className="card card-body"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', padding: '12px 16px',
        border: isToday ? '2px solid #6C5CE7' : '1.5px solid transparent',
      }}
    >
      {/* Date label */}
      <div style={{ width: 40, textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: '#A0A0B8' }}>{dayLabel}</div>
        <div style={{ fontSize: 18, fontWeight: isToday ? 700 : 500, color: isToday ? '#6C5CE7' : '#1E1E2E', lineHeight: 1.2 }}>
          {date.getDate()}
        </div>
      </div>

      {/* Rate bubble */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
        background: rate !== null ? `${rateColor}20` : '#F5F5FA',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: rate !== null ? rateColor : '#CCC' }}>
          {rate !== null ? `${rate}%` : '—'}
        </span>
      </div>

      {/* Brief health info */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {record?.completed ? (
          <>
            {record.sleepHours != null && (
              <span style={{ fontSize: 12, color: '#A0A0B8' }}>💤 {record.sleepHours}h 수면</span>
            )}
            {record.exercise ? (
              <span style={{ fontSize: 12, color: '#00B894' }}>
                💪 운동{exerciseDuration ? ` ${exerciseDuration}` : ''}
              </span>
            ) : record.exercise === false ? (
              <span style={{ fontSize: 12, color: '#A0A0B8' }}>🛋️ 휴식</span>
            ) : null}
          </>
        ) : (
          <span style={{ fontSize: 12, color: '#C0C0D0' }}>{record ? '루틴만 기록' : '기록 없음'}</span>
        )}
      </div>

      <span style={{ fontSize: 18, color: '#D0D0D8' }}>›</span>
    </div>
  )
}

// ─── Date Picker Modal ────────────────────────────────────────────────────────

function DatePickerModal({ value, tab, onSelect, onClose }) {
  const [pickerYear, setPickerYear] = useState(value.getFullYear())
  const [pickerMonth, setPickerMonth] = useState(value.getMonth())
  const today = new Date()

  const prevM = () => {
    if (pickerMonth === 0) { setPickerYear(y => y - 1); setPickerMonth(11) }
    else setPickerMonth(m => m - 1)
  }
  const nextM = () => {
    if (pickerMonth === 11) { setPickerYear(y => y + 1); setPickerMonth(0) }
    else setPickerMonth(m => m + 1)
  }

  // Month picker (for month tab)
  if (tab === 'month') {
    return (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.48)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={onClose}
      >
        <div
          style={{ background: 'white', borderRadius: 20, padding: '24px 20px', width: '82%', maxWidth: 340 }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center', marginBottom: 18 }}>월 선택</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <button onClick={() => setPickerYear(y => y - 1)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6C5CE7', padding: '4px 10px' }}>‹</button>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{pickerYear}년</span>
            <button onClick={() => setPickerYear(y => y + 1)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6C5CE7', padding: '4px 10px' }}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {Array.from({ length: 12 }, (_, i) => {
              const isSel = i === value.getMonth() && pickerYear === value.getFullYear()
              const isCurr = i === today.getMonth() && pickerYear === today.getFullYear()
              const isFuture = pickerYear > today.getFullYear() || (pickerYear === today.getFullYear() && i > today.getMonth())
              return (
                <button
                  key={i}
                  disabled={isFuture}
                  onClick={() => onSelect(new Date(pickerYear, i, 1))}
                  style={{
                    padding: '11px 0', borderRadius: 10, border: 'none', cursor: isFuture ? 'default' : 'pointer',
                    background: isSel ? '#6C5CE7' : isCurr ? '#F0EEFF' : '#F5F5FA',
                    color: isFuture ? '#D0D0D0' : isSel ? 'white' : isCurr ? '#6C5CE7' : '#1E1E2E',
                    fontWeight: isSel || isCurr ? 700 : 400, fontSize: 13,
                  }}
                >
                  {i + 1}월
                </button>
              )
            })}
          </div>
          <button
            onClick={onClose}
            style={{ marginTop: 16, width: '100%', padding: '11px', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#F5F5FA', color: '#A0A0B8', fontSize: 14 }}
          >
            닫기
          </button>
        </div>
      </div>
    )
  }

  // Day / Week picker (bottom sheet with full calendar)
  const firstDay = new Date(pickerYear, pickerMonth, 1).getDay()
  const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate()

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.48)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '16px 16px 36px', width: '100%', maxWidth: 480 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E0E0E0', margin: '0 auto 18px' }} />

        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={prevM} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6C5CE7', padding: '4px 12px' }}>‹</button>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{pickerYear}년 {pickerMonth + 1}월</span>
          <button onClick={nextM} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6C5CE7', padding: '4px 12px' }}>›</button>
        </div>

        {/* Day headers */}
        <div className="calendar-grid" style={{ marginBottom: 6 }}>
          {DAY_NAMES.map((d, i) => (
            <div key={d} className="cal-day-header" style={{ color: i === 0 ? '#FF7675' : i === 6 ? '#6C5CE7' : undefined }}>{d}</div>
          ))}
        </div>

        {/* Days */}
        <div className="calendar-grid">
          {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1
            const isToday = pickerYear === today.getFullYear() && pickerMonth === today.getMonth() && d === today.getDate()
            const isSelected = pickerYear === value.getFullYear() && pickerMonth === value.getMonth() && d === value.getDate()
            const dow = new Date(pickerYear, pickerMonth, d).getDay()
            const isFuture = new Date(pickerYear, pickerMonth, d) > today
            return (
              <div
                key={d}
                className={`cal-day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
                onClick={() => !isFuture && onSelect(new Date(pickerYear, pickerMonth, d))}
                style={{
                  color: isFuture ? '#D0D0D0' : isSelected ? 'white' : dow === 0 ? '#FF7675' : dow === 6 ? '#6C5CE7' : undefined,
                  fontWeight: isToday || isSelected ? 700 : 400,
                  cursor: isFuture ? 'default' : 'pointer',
                  opacity: isFuture ? 0.4 : 1,
                }}
              >
                {d}
              </div>
            )
          })}
        </div>

        <button
          onClick={onClose}
          style={{ marginTop: 16, width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer', background: '#F5F5FA', color: '#A0A0B8', fontSize: 14 }}
        >
          닫기
        </button>
      </div>
    </div>
  )
}
