import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentHourData, CIRCADIAN_DATA, PHASE_COLORS } from '../data/circadianGuide'

export default function CircadianDetail() {
  const navigate = useNavigate()
  const [hourData, setHourData] = useState(() => getCurrentHourData())

  useEffect(() => {
    function scheduleNextHourUpdate() {
      const n = new Date()
      const msUntilNextHour =
        (60 - n.getMinutes()) * 60 * 1000
        - n.getSeconds() * 1000
        - n.getMilliseconds()
      const t = setTimeout(() => {
        setHourData(getCurrentHourData())
        scheduleNextHourUpdate()
      }, msUntilNextHour)
      return t
    }
    const t = scheduleNextHourUpdate()
    return () => clearTimeout(t)
  }, [])

  const colors = PHASE_COLORS[hourData.phase]

  const strengthLabel = {
    confirmed: { text: '근거 확실', color: '#00B894' },
    strong: { text: '근거 강함', color: '#0984E3' },
    moderate: { text: '근거 중간', color: '#E67E22' },
    conditional: { text: '조건부', color: '#A0A0B8' },
  }

  return (
    <div className="page fade-up">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 0, color: '#6C5CE7' }}
          >
            ←
          </button>
          <div>
            <div className="header-title">시간대 상세</div>
            <div className="header-sub">{hourData.phaseName} · {hourData.stateName}</div>
          </div>
        </div>
      </div>

      {/* Current hour summary */}
      <div className="section">
        <div className="card" style={{ background: colors.bg, border: 'none' }}>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.accent, marginBottom: 6 }}>
              {String(hourData.hour).padStart(2, '0')}:00 · {hourData.phaseName}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, marginBottom: 10 }}>
              {hourData.stateName}
            </div>
            {/* Hormones */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {hourData.hormones.map((h, i) => (
                <span key={i} style={{
                  fontSize: 11, fontWeight: 600, color: colors.accent,
                  background: 'rgba(0,0,0,0.07)', padding: '3px 9px', borderRadius: 20,
                }}>
                  {h}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="section">
        <div className="section-title">지금 할 일</div>
        <div className="card card-body" style={{ gap: 12 }}>
          {hourData.actions.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: colors.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 12, fontWeight: 700,
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{a.label}</div>
                <div style={{ fontSize: 12, color: '#6E6E8A', lineHeight: 1.5 }}>{a.reason}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {hourData.warnings.length > 0 && (
        <div className="section">
          <div className="section-title">주의할 것</div>
          <div className="card card-body" style={{ gap: 10 }}>
            {hourData.warnings.map((w, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>⚠</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{w.label}</div>
                  <div style={{ fontSize: 12, color: '#6E6E8A', lineHeight: 1.5 }}>{w.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Science */}
      <div className="section" style={{ paddingBottom: 20 }}>
        <div className="section-title">과학적 근거</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {hourData.science.map((s, i) => {
            const sl = strengthLabel[s.strength] ?? strengthLabel.moderate
            return (
              <div key={i} className="card card-body" style={{ gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1E1E2E', flex: 1 }}>{s.claim}</div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: sl.color,
                    background: sl.color + '18', padding: '3px 8px', borderRadius: 20, flexShrink: 0,
                  }}>
                    {sl.text}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#6E6E8A', lineHeight: 1.6 }}>{s.evidence}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
