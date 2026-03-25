import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTodayKey, getRecord, saveRecord, getSettings, formatDate } from '../utils/storage'

export default function MorningCheckin() {
  const navigate = useNavigate()
  const today = getTodayKey()
  const existing = getRecord(today) || {}
  const settings = getSettings()

  const [step, setStep] = useState(0)
  const [wakeTime, setWakeTime] = useState(existing.wakeTime || settings.wakeTime)
  const [sleepTime, setSleepTime] = useState(existing.sleepTime || settings.sleepTime)
  const [sleepQuality, setSleepQuality] = useState(existing.sleepQuality || 0)
  const [meals, setMeals] = useState(existing.meals || { breakfast: false, lunch: false, dinner: false })
  const [exercise, setExercise] = useState(existing.exercise || false)
  const [exerciseMins, setExerciseMins] = useState(existing.exerciseMinutes || 30)

  const totalSteps = 4

  const calcWakeOnTime = () => {
    const [th, tm] = settings.wakeTime.split(':').map(Number)
    const [ah, am] = wakeTime.split(':').map(Number)
    return Math.abs((ah * 60 + am) - (th * 60 + tm)) <= 15
  }

  const calcSleepHours = () => {
    const [sh, sm] = sleepTime.split(':').map(Number)
    const [wh, wm] = wakeTime.split(':').map(Number)
    let diff = (wh * 60 + wm) - (sh * 60 + sm)
    if (diff < 0) diff += 24 * 60
    return Math.round(diff / 60 * 10) / 10
  }

  const handleSubmit = () => {
    const record = {
      date: today,
      wakeTime,
      sleepTime,
      sleepQuality,
      sleepHours: calcSleepHours(),
      wakeOnTime: calcWakeOnTime(),
      meals,
      exercise,
      exerciseMinutes: exercise ? exerciseMins : 0,
      completed: true,
      completedAt: new Date().toISOString(),
    }
    saveRecord(today, record)
    navigate('/')
  }

  const toggleMeal = (key) => setMeals(m => ({ ...m, [key]: !m[key] }))

  const progress = ((step + 1) / totalSteps) * 100

  return (
    <div className="page-no-nav fade-up" style={{ background: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #6C5CE7 0%, #a29bfe 100%)',
        padding: '20px 20px 32px',
        paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
        color: 'white',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => step === 0 ? navigate('/') : setStep(s => s - 1)}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, color: 'white', padding: '8px 12px', cursor: 'pointer', fontSize: 15 }}
          >
            ←
          </button>
          <div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>{formatDate(today)}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>아침 체크인</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 13, opacity: 0.8 }}>
            {step + 1}/{totalSteps}
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ height: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'white', borderRadius: 2, transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ position: 'absolute', bottom: -20, left: 0, right: 0, height: 40, background: '#FAFAFA', borderRadius: '20px 20px 0 0' }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '28px 20px 24px', background: '#FAFAFA' }}>
        {step === 0 && (
          <StepSleep
            wakeTime={wakeTime}
            sleepTime={sleepTime}
            onWakeChange={setWakeTime}
            onSleepChange={setSleepTime}
            sleepHours={calcSleepHours()}
            targetWake={settings.wakeTime}
            onTime={calcWakeOnTime()}
          />
        )}
        {step === 1 && (
          <StepQuality value={sleepQuality} onChange={setSleepQuality} />
        )}
        {step === 2 && (
          <StepMeals meals={meals} onToggle={toggleMeal} />
        )}
        {step === 3 && (
          <StepExercise
            exercise={exercise}
            onToggle={() => setExercise(e => !e)}
            mins={exerciseMins}
            onMinsChange={setExerciseMins}
          />
        )}
      </div>

      {/* Bottom button */}
      <div style={{ padding: '16px 20px', paddingBottom: 'max(24px, calc(env(safe-area-inset-bottom) + 16px))', background: '#FAFAFA', borderTop: '1px solid #EEE' }}>
        {step < totalSteps - 1 ? (
          <button className="btn btn-primary btn-full" onClick={() => setStep(s => s + 1)}>
            다음
          </button>
        ) : (
          <button className="btn btn-primary btn-full" onClick={handleSubmit}>
            체크인 완료 🎉
          </button>
        )}
      </div>
    </div>
  )
}

function StepSleep({ wakeTime, sleepTime, onWakeChange, onSleepChange, sleepHours, targetWake, onTime }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>수면 기록</h2>
        <p style={{ fontSize: 14, color: '#6E6E8A' }}>어젯밤 수면 시간을 입력해주세요</p>
      </div>

      <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="input-group">
          <label className="input-label">취침 시간 (어제)</label>
          <input type="time" value={sleepTime} onChange={e => onSleepChange(e.target.value)} className="input input-time" />
        </div>
        <div style={{ height: 1, background: '#EEE' }} />
        <div className="input-group">
          <label className="input-label">기상 시간 (오늘)</label>
          <input type="time" value={wakeTime} onChange={e => onWakeChange(e.target.value)} className="input input-time" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div className="card card-body" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#6C5CE7' }}>{sleepHours}h</div>
          <div style={{ fontSize: 12, color: '#6E6E8A', marginTop: 2 }}>수면 시간</div>
        </div>
        <div className="card card-body" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: onTime ? '#00B894' : '#FF7675' }}>
            {onTime ? '👍' : '👎'}
          </div>
          <div style={{ fontSize: 12, color: '#6E6E8A', marginTop: 2 }}>
            {onTime ? '제 시간 기상' : '늦은 기상'}
          </div>
        </div>
      </div>
    </div>
  )
}

function StepQuality({ value, onChange }) {
  const labels = ['', '매우 나쁨', '나쁨', '보통', '좋음', '매우 좋음']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>수면 질</h2>
        <p style={{ fontSize: 14, color: '#6E6E8A' }}>어젯밤 수면의 질은 어땠나요?</p>
      </div>
      <div style={{ fontSize: 64 }}>
        {value === 0 ? '😶' : value === 1 ? '😫' : value === 2 ? '😕' : value === 3 ? '😐' : value === 4 ? '😊' : '😄'}
      </div>
      <div className="stars">
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            className={`star-btn${n <= value ? ' active' : ''}`}
            onClick={() => onChange(n)}
          >
            ⭐
          </button>
        ))}
      </div>
      {value > 0 && (
        <div style={{ padding: '10px 24px', background: '#F5F4FF', borderRadius: 12, color: '#6C5CE7', fontWeight: 600, fontSize: 15 }}>
          {labels[value]}
        </div>
      )}
    </div>
  )
}

function StepMeals({ meals, onToggle }) {
  const items = [
    { key: 'breakfast', label: '아침 식사', icon: '🍳', sub: '오전 7~9시' },
    { key: 'lunch', label: '점심 식사', icon: '🥗', sub: '오후 12~1시' },
    { key: 'dinner', label: '저녁 식사', icon: '🍚', sub: '오후 6~7시' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>식사 기록</h2>
        <p style={{ fontSize: 14, color: '#6E6E8A' }}>오늘 먹은 식사를 체크해주세요</p>
      </div>
      <div className="card">
        {items.map(({ key, label, icon, sub }) => (
          <div
            key={key}
            className="checkin-option"
            style={{ padding: '16px 20px' }}
            onClick={() => onToggle(key)}
          >
            <span style={{ fontSize: 28 }}>{icon}</span>
            <div style={{ flex: 1 }}>
              <div className="checkbox-label">{label}</div>
              <div style={{ fontSize: 12, color: '#A0A0B8' }}>{sub}</div>
            </div>
            <div className={`checkbox-custom${meals[key] ? ' checked' : ''}`}>
              {meals[key] && <span style={{ color: 'white', fontSize: 14 }}>✓</span>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', fontSize: 13, color: '#A0A0B8' }}>
        {Object.values(meals).filter(Boolean).length}끼 식사 완료
      </div>
    </div>
  )
}

function StepExercise({ exercise, onToggle, mins, onMinsChange }) {
  const presets = [15, 30, 45, 60, 90]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>운동 기록</h2>
        <p style={{ fontSize: 14, color: '#6E6E8A' }}>오늘 운동을 하셨나요?</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <button
          onClick={() => !exercise && onToggle()}
          style={{
            padding: 20,
            borderRadius: 16,
            border: `2px solid ${exercise ? '#6C5CE7' : '#EEE'}`,
            background: exercise ? '#F5F4FF' : 'white',
            cursor: 'pointer',
            textAlign: 'center',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: 36 }}>💪</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: exercise ? '#6C5CE7' : '#888', marginTop: 8 }}>운동했어요</div>
        </button>
        <button
          onClick={() => exercise && onToggle()}
          style={{
            padding: 20,
            borderRadius: 16,
            border: `2px solid ${!exercise ? '#6C5CE7' : '#EEE'}`,
            background: !exercise ? '#F5F4FF' : 'white',
            cursor: 'pointer',
            textAlign: 'center',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: 36 }}>🛋️</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: !exercise ? '#6C5CE7' : '#888', marginTop: 8 }}>안 했어요</div>
        </button>
      </div>

      {exercise && (
        <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#6E6E8A' }}>운동 시간</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {presets.map(p => (
              <button
                key={p}
                onClick={() => onMinsChange(p)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 20,
                  border: `2px solid ${mins === p ? '#6C5CE7' : '#EEE'}`,
                  background: mins === p ? '#6C5CE7' : 'white',
                  color: mins === p ? 'white' : '#888',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {p}분
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#6E6E8A' }}>직접 입력:</span>
            <input
              type="number"
              value={mins}
              onChange={e => onMinsChange(Number(e.target.value))}
              className="input"
              style={{ width: 80, textAlign: 'center', padding: '8px 12px' }}
              min={5}
              max={300}
            />
            <span style={{ fontSize: 13, color: '#6E6E8A' }}>분</span>
          </div>
        </div>
      )}
    </div>
  )
}
