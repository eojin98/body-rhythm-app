import { useState } from 'react'

/**
 * 오전/오후 토글 + 시:분 숫자 입력 방식의 공통 시간 입력 컴포넌트.
 * value/onChange 모두 "HH:MM" (24시간) 형식을 사용한다.
 */
export default function TimeInputField({ value, onChange, defaultValue = '12:00' }) {
  const init = value || defaultValue
  const [ih, im] = init.split(':').map(Number)

  const [isPM, setIsPM] = useState(ih >= 12)
  const ih12 = ih === 0 ? 12 : ih > 12 ? ih - 12 : ih
  const [hourStr, setHourStr] = useState(String(ih12))
  const [minStr, setMinStr] = useState(String(im).padStart(2, '0'))

  const commit = (h12, m, pm) => {
    const h24 = pm ? (h12 === 12 ? 12 : h12 + 12) : (h12 === 12 ? 0 : h12)
    onChange(`${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }

  const setAMPM = (toPM) => {
    if (toPM === isPM) return
    setIsPM(toPM)
    const h = Math.min(12, Math.max(1, parseInt(hourStr, 10) || 12))
    const m = Math.min(59, Math.max(0, parseInt(minStr, 10) || 0))
    commit(h, m, toPM)
  }

  const handleHourBlur = () => {
    let n = parseInt(hourStr, 10)
    if (isNaN(n) || n < 1) n = 1
    if (n > 12) n = 12
    setHourStr(String(n))
    const m = Math.min(59, Math.max(0, parseInt(minStr, 10) || 0))
    commit(n, m, isPM)
  }

  const handleMinBlur = () => {
    let n = parseInt(minStr, 10)
    if (isNaN(n) || n < 0) n = 0
    if (n > 59) n = 59
    setMinStr(String(n).padStart(2, '0'))
    const h = Math.min(12, Math.max(1, parseInt(hourStr, 10) || 12))
    commit(h, n, isPM)
  }

  const numStyle = {
    width: 60, height: 54, textAlign: 'center', fontSize: 24, fontWeight: 700,
    border: '2px solid #E0DFFF', borderRadius: 12, outline: 'none',
    background: '#F5F4FF', color: '#1E1E2E', fontFamily: 'inherit',
    MozAppearance: 'textfield',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {/* 오전/오후 세그먼트 토글 */}
      <div style={{
        display: 'flex', borderRadius: 12, overflow: 'hidden',
        border: '2px solid #6C5CE7', flexShrink: 0,
      }}>
        {[['오전', false], ['오후', true]].map(([lbl, pm]) => (
          <button
            key={lbl}
            type="button"
            onClick={() => setAMPM(pm)}
            style={{
              padding: '0 14px', height: 54, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 14,
              background: isPM === pm ? '#6C5CE7' : 'white',
              color: isPM === pm ? 'white' : '#6C5CE7',
              transition: 'background 0.15s, color 0.15s',
              userSelect: 'none',
            }}
          >
            {lbl}
          </button>
        ))}
      </div>
      {/* HH : MM */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number"
          min={1}
          max={12}
          value={hourStr}
          onChange={e => setHourStr(e.target.value)}
          onBlur={handleHourBlur}
          style={numStyle}
        />
        <span style={{ fontSize: 26, fontWeight: 800, color: '#6C5CE7', lineHeight: 1, userSelect: 'none' }}>:</span>
        <input
          type="number"
          min={0}
          max={59}
          value={minStr}
          onChange={e => setMinStr(e.target.value)}
          onBlur={handleMinBlur}
          style={numStyle}
        />
      </div>
    </div>
  )
}
