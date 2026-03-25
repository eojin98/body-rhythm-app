import { getRecords, getLastWeekDates, calculatePracticeRate } from '../utils/storage'

export default function Dashboard() {
  const records = getRecords()
  const weekDates = getLastWeekDates()

  const weekData = weekDates.map(({ key, label }) => {
    const rec = records[key]
    return {
      label,
      key,
      rate: rec ? calculatePracticeRate(rec) : null,
      sleep: rec?.sleepHours ?? null,
      sleepQuality: rec?.sleepQuality ?? null,
      exercise: rec?.exercise ?? false,
      exerciseMins: rec?.exerciseMinutes ?? 0,
      completed: rec?.completed ?? false,
    }
  })

  // Stats
  const completedDays = weekData.filter(d => d.completed)
  const avgRate = completedDays.length
    ? Math.round(completedDays.reduce((s, d) => s + d.rate, 0) / completedDays.length)
    : 0
  const avgSleep = completedDays.filter(d => d.sleep).length
    ? Math.round(completedDays.filter(d => d.sleep).reduce((s, d) => s + d.sleep, 0) / completedDays.filter(d => d.sleep).length * 10) / 10
    : 0
  const exerciseDays = weekData.filter(d => d.exercise).length
  const totalExerciseMins = weekData.reduce((s, d) => s + d.exerciseMins, 0)

  // Exercise streak
  const allDates = Object.keys(records).sort().reverse()
  let streak = 0
  for (const dateKey of allDates) {
    if (records[dateKey]?.exercise) streak++
    else break
  }

  return (
    <div className="page fade-up">
      {/* Header */}
      <div className="page-header">
        <div className="header-title">통계</div>
        <div className="header-sub">지난 7일간의 나의 리듬</div>
      </div>

      {/* Summary Cards */}
      <div className="section">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <SummaryCard icon="📊" value={`${avgRate}%`} label="평균 실천율" color="#6C5CE7" />
          <SummaryCard icon="😴" value={`${avgSleep}h`} label="평균 수면" color="#00CEC9" />
          <SummaryCard icon="💪" value={`${exerciseDays}일`} label="운동일수" color="#00B894" />
        </div>
      </div>

      {/* Practice Rate Chart */}
      <div className="section">
        <div className="section-title">실천율</div>
        <div className="card card-body">
          <BarChart
            data={weekData.map(d => ({ label: d.label, value: d.rate, filled: d.completed }))}
            maxValue={100}
            color="#6C5CE7"
            unit="%"
            height={140}
          />
        </div>
      </div>

      {/* Sleep Chart */}
      <div className="section">
        <div className="section-title">수면 시간</div>
        <div className="card card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, height: 2, background: '#E8E6F8', borderRadius: 1 }}>
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: `${(7 / 10) * 100}%`,
                  top: -8,
                  fontSize: 10,
                  color: '#00B894',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}>권장 7-9h</div>
              </div>
            </div>
          </div>
          <BarChart
            data={weekData.map(d => ({ label: d.label, value: d.sleep, filled: d.sleep !== null }))}
            maxValue={10}
            color="#00CEC9"
            unit="h"
            height={140}
            referenceLines={[{ value: 7, color: '#00B894' }, { value: 9, color: '#FDCB6E' }]}
          />
        </div>
      </div>

      {/* Exercise */}
      <div className="section">
        <div className="section-title">운동 현황</div>
        <div className="card card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ textAlign: 'center', padding: 16, background: '#F5F4FF', borderRadius: 14 }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#6C5CE7' }}>{streak}</div>
              <div style={{ fontSize: 12, color: '#A0A0B8', marginTop: 4 }}>연속 운동일 🔥</div>
            </div>
            <div style={{ textAlign: 'center', padding: 16, background: '#E6FBF5', borderRadius: 14 }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#00B894' }}>{totalExerciseMins}</div>
              <div style={{ fontSize: 12, color: '#A0A0B8', marginTop: 4 }}>주간 운동 분 💪</div>
            </div>
          </div>

          {/* Weekly exercise dots */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
            {weekData.map(d => (
              <div key={d.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: d.exercise ? '#00B894' : d.completed ? '#F5F5F5' : '#FAFAFA',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                  border: d.exercise ? 'none' : '2px solid #EEE',
                }}>
                  {d.exercise ? '💪' : d.completed ? '😴' : ''}
                </div>
                <div style={{ fontSize: 11, color: '#A0A0B8', fontWeight: 500 }}>{d.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sleep Quality */}
      <div className="section" style={{ paddingBottom: 20 }}>
        <div className="section-title">수면 질</div>
        <div className="card card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 4px' }}>
            {weekData.map(d => (
              <div key={d.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                  {[5,4,3,2,1].map(star => (
                    <div key={star} style={{
                      width: 20, height: 8, borderRadius: 3,
                      background: d.sleepQuality && d.sleepQuality >= star ? '#FDCB6E' : '#EEE',
                    }} />
                  ))}
                </div>
                <div style={{ fontSize: 11, color: '#A0A0B8', fontWeight: 500 }}>{d.label}</div>
              </div>
            ))}
          </div>
          {completedDays.filter(d => d.sleepQuality).length > 0 && (
            <div style={{ marginTop: 14, textAlign: 'center', fontSize: 13, color: '#6E6E8A' }}>
              평균 수면 질:{' '}
              <strong style={{ color: '#FDCB6E' }}>
                {'⭐'.repeat(Math.round(
                  completedDays.filter(d => d.sleepQuality).reduce((s, d) => s + d.sleepQuality, 0) /
                  completedDays.filter(d => d.sleepQuality).length
                ))}
              </strong>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ icon, value, label, color }) {
  return (
    <div className="card card-body" style={{ textAlign: 'center', padding: '16px 12px' }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#A0A0B8', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function BarChart({ data, maxValue, color, unit = '', height = 140, referenceLines = [] }) {
  const barW = 32
  const gap = 8
  const padLeft = 28
  const padBottom = 28
  const padTop = 16
  const totalW = data.length * (barW + gap) - gap + padLeft
  const chartH = height - padBottom - padTop

  const scale = (val) => (val / maxValue) * chartH

  return (
    <div className="chart-wrap">
      <svg width="100%" viewBox={`0 0 ${totalW} ${height}`} style={{ overflow: 'visible' }}>
        {/* Reference lines */}
        {referenceLines.map(({ value, color: lc }) => {
          const y = padTop + chartH - scale(value)
          return (
            <line
              key={value}
              x1={padLeft}
              y1={y}
              x2={totalW}
              y2={y}
              stroke={lc}
              strokeWidth="1.5"
              strokeDasharray="4 3"
              opacity="0.6"
            />
          )
        })}

        {/* Bars */}
        {data.map((item, i) => {
          const x = padLeft + i * (barW + gap)
          const val = item.value ?? 0
          const barH = Math.max(val > 0 ? scale(val) : 0, val > 0 ? 4 : 0)
          const y = padTop + chartH - barH

          return (
            <g key={i}>
              {/* Background bar */}
              <rect
                x={x}
                y={padTop}
                width={barW}
                height={chartH}
                rx={6}
                fill="#F5F4FF"
              />
              {/* Value bar */}
              {item.filled && val > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  rx={6}
                  fill={color}
                  opacity="0.85"
                />
              )}
              {/* Value label */}
              {item.filled && val > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 4}
                  textAnchor="middle"
                  fontSize="10"
                  fill={color}
                  fontWeight="600"
                >
                  {val}{unit}
                </text>
              )}
              {/* Day label */}
              <text
                x={x + barW / 2}
                y={height - 4}
                textAnchor="middle"
                fontSize="11"
                fill="#A0A0B8"
                fontWeight="500"
              >
                {item.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
