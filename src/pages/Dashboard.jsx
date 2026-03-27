import { useState } from 'react'
import { getRecords, getLastWeekDates, calculatePracticeRate, getSettings } from '../utils/storage'
import { ALARM_PERIODS, PERIOD_ORDER, getEffectiveBehaviors } from '../utils/alarmContent'

const TABS = PERIOD_ORDER.map(id => ({ id, ...ALARM_PERIODS[id] }))

export default function Dashboard() {
  const [tab, setTab] = useState('morning')

  const records = getRecords()
  const weekDates = getLastWeekDates()
  const period = ALARM_PERIODS[tab]
  const customBehaviors = getSettings().behaviors
  const behaviors = getEffectiveBehaviors(tab, customBehaviors)

  // Weekly data for the active tab
  const weekData = weekDates.map(({ key, label }) => {
    const rec = records[key]
    const routineStatus = rec?.routines?.[tab]?.status || null
    return {
      key,
      label,
      status: routineStatus,          // 'done' | 'skipped' | null
      rate: rec ? calculatePracticeRate(rec) : null,
      completed: rec?.completed ?? false,
    }
  })

  const doneCount = weekData.filter(d => d.status === 'done').length
  const skippedCount = weekData.filter(d => d.status === 'skipped').length
  const totalTracked = weekData.filter(d => d.status !== null).length
  const weekRate = totalTracked > 0 ? Math.round((doneCount / 7) * 100) : 0

  // Overall stats across all periods
  const allStats = PERIOD_ORDER.map(pid => {
    const done = weekDates.filter(({ key }) => records[key]?.routines?.[pid]?.status === 'done').length
    return { id: pid, done, period: ALARM_PERIODS[pid] }
  })

  return (
    <div className="page fade-up">
      {/* Header */}
      <div className="page-header">
        <div className="header-title">통계</div>
        <div className="header-sub">지난 7일간의 루틴 실천 현황</div>
      </div>

      {/* Overall summary strip */}
      <div className="section">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {allStats.map(({ id, done, period: p }) => (
            <div key={id} className="card card-body" style={{ textAlign: 'center', padding: '12px 8px' }}>
              <div style={{ fontSize: 20 }}>{p.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: p.color, marginTop: 4 }}>{done}</div>
              <div style={{ fontSize: 10, color: '#A0A0B8', marginTop: 2 }}>일 완료</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="section">
        <div style={{
          display: 'flex', background: 'white', borderRadius: 14,
          padding: 4, gap: 4,
          boxShadow: '0 2px 12px rgba(108,92,231,0.08)',
        }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: tab === t.id ? t.gradient : 'transparent',
                color: tab === t.id ? 'white' : '#A0A0B8',
                fontSize: 11, fontWeight: 600,
                transition: 'all 0.2s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}
            >
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <span>{t.id === 'morning' ? '아침' : t.id === 'afternoon' ? '오후' : t.id === 'evening' ? '저녁' : '취침'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="section">
        {/* Period info + week rate */}
        <div className="card card-body" style={{ background: period.gradient, color: 'white', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 36 }}>{period.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{period.name}</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
                {behaviors.map(b => b.title).join(' · ')}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{weekRate}%</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>주간 달성률</div>
            </div>
          </div>
        </div>

        {/* Weekly bar chart */}
        <div className="card card-body" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6E8A', marginBottom: 16 }}>주간 실천 현황</div>
          <WeeklyRoutineChart data={weekData} color={period.color} gradient={period.gradient} />
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 14 }}>
            {[['#00B894', '완료'], ['#FDCB6E', '건너뜀'], ['#EEE', '기록 없음']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
                <span style={{ fontSize: 11, color: '#A0A0B8' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
          <StatCard value={`${doneCount}일`} label="완료" color="#00B894" bg="#E6FBF5" />
          <StatCard value={`${skippedCount}일`} label="건너뜀" color="#FDCB6E" bg="#FFF8E6" />
          <StatCard value={`${7 - doneCount - skippedCount}일`} label="기록 없음" color="#A0A0B8" bg="#F5F5F5" />
        </div>

        {/* Behavior breakdown */}
        <div className="card">
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0EFF8' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6E8A' }}>이번 주 루틴 내용</div>
          </div>
          {behaviors.map((b, i) => (
            <div key={b.id} style={{
              padding: '14px 20px',
              borderBottom: i < behaviors.length - 1 ? '1px solid #F0EFF8' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: period.gradient,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 12, fontWeight: 700,
                }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{b.title}</div>
                  <div style={{ fontSize: 12, color: '#A0A0B8', marginTop: 2, lineHeight: 1.5 }}>{b.desc}</div>
                  <div style={{ fontSize: 11, color: '#6E6E8A', marginTop: 6, padding: '3px 8px', background: '#F5F4FF', borderRadius: 8, display: 'inline-block' }}>
                    💡 {b.tip}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Morning checkin summary (only on morning tab) */}
      {tab === 'morning' && <MorningCheckinSummary records={records} weekDates={weekDates} />}
    </div>
  )
}

// ─── Weekly routine dots chart ─────────────────────────────────────────────────

function WeeklyRoutineChart({ data, color, gradient }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      {data.map(d => {
        const bg = d.status === 'done'
          ? gradient
          : d.status === 'skipped'
            ? 'linear-gradient(135deg, #FDCB6E, #F0A030)'
            : '#EEE'
        const textColor = d.status === 'done' ? 'white' : d.status === 'skipped' ? 'white' : '#CCC'
        return (
          <div key={d.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: textColor,
            }}>
              {d.status === 'done' ? '✓' : d.status === 'skipped' ? '–' : ''}
            </div>
            <div style={{ fontSize: 11, color: '#A0A0B8', fontWeight: 500 }}>{d.label}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Morning checkin summary (아침 탭 전용) ────────────────────────────────────

function MorningCheckinSummary({ records, weekDates }) {
  const completedDays = weekDates
    .map(({ key }) => records[key])
    .filter(r => r?.completed)

  if (completedDays.length === 0) return null

  const avgSleep = completedDays.filter(r => r.sleepHours).length
    ? Math.round(completedDays.reduce((s, r) => s + (r.sleepHours || 0), 0) / completedDays.filter(r => r.sleepHours).length * 10) / 10
    : 0
  const wakeOnTimeCount = completedDays.filter(r => r.wakeOnTime).length
  const exerciseCount = completedDays.filter(r => r.exercise).length

  return (
    <div className="section" style={{ paddingBottom: 20 }}>
      <div className="section-title">모닝 체크인 요약</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <StatCard value={`${avgSleep}h`} label="평균 수면" color="#6C5CE7" bg="#F5F4FF" />
        <StatCard value={`${wakeOnTimeCount}일`} label="제 시간 기상" color="#00B894" bg="#E6FBF5" />
        <StatCard value={`${exerciseCount}일`} label="운동 완료" color="#00CEC9" bg="#E6FAFA" />
      </div>

      <div className="card card-body" style={{ marginTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6E8A', marginBottom: 14 }}>수면 시간 (주간)</div>
        <BarChart
          data={weekDates.map(({ key, label }) => ({
            label,
            value: records[key]?.sleepHours ?? null,
            filled: records[key]?.completed ?? false,
          }))}
          maxValue={10}
          color="#6C5CE7"
          unit="h"
          referenceLines={[{ value: 7, color: '#00B894' }, { value: 9, color: '#FDCB6E' }]}
        />
      </div>
    </div>
  )
}

// ─── Shared components ────────────────────────────────────────────────────────

function StatCard({ value, label, color, bg }) {
  return (
    <div className="card card-body" style={{ textAlign: 'center', padding: '14px 8px', background: bg }}>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#A0A0B8', marginTop: 3 }}>{label}</div>
    </div>
  )
}

function BarChart({ data, maxValue, color, unit = '', referenceLines = [] }) {
  const barW = 32
  const gap = 8
  const padLeft = 8
  const padBottom = 28
  const padTop = 20
  const height = 130
  const totalW = data.length * (barW + gap) - gap + padLeft
  const chartH = height - padBottom - padTop
  const scale = val => (val / maxValue) * chartH

  return (
    <div className="chart-wrap">
      <svg width="100%" viewBox={`0 0 ${totalW} ${height}`} style={{ overflow: 'visible' }}>
        {referenceLines.map(({ value, color: lc }) => {
          const y = padTop + chartH - scale(value)
          return (
            <line key={value} x1={padLeft} y1={y} x2={totalW} y2={y}
              stroke={lc} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />
          )
        })}
        {data.map((item, i) => {
          const x = padLeft + i * (barW + gap)
          const val = item.value ?? 0
          const barH = Math.max(val > 0 ? scale(val) : 0, val > 0 ? 4 : 0)
          const y = padTop + chartH - barH
          return (
            <g key={i}>
              <rect x={x} y={padTop} width={barW} height={chartH} rx={6} fill="#F5F4FF" />
              {item.filled && val > 0 && (
                <rect x={x} y={y} width={barW} height={barH} rx={6} fill={color} opacity="0.85" />
              )}
              {item.filled && val > 0 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="10" fill={color} fontWeight="600">
                  {val}{unit}
                </text>
              )}
              <text x={x + barW / 2} y={height - 4} textAnchor="middle" fontSize="11" fill="#A0A0B8" fontWeight="500">
                {item.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
