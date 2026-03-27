import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTodayKey, getRecord, saveRecord, getSettings, formatDate } from '../utils/storage'

// Handle migration from old format (boolean) to new format ({ skipped, time })
function initMeals(saved) {
  const get = (key) => {
    const v = saved?.[key]
    if (v == null) return { skipped: false, time: '' }
    if (typeof v === 'boolean') return { skipped: !v, time: '' }
    return v
  }
  return {
    breakfast: get('breakfast'),
    lunch: get('lunch'),
    dinner: get('dinner'),
    latenight: saved?.latenight ? get('latenight') : { skipped: true, time: '' },
  }
}

export default function MorningCheckin() {
  const navigate = useNavigate()
  const today = getTodayKey()
  const existing = getRecord(today) || {}
  const settings = getSettings()

  const [step, setStep] = useState(0)
  const [wakeTime, setWakeTime] = useState(existing.wakeTime || settings.wakeTime)
  const [sleepTime, setSleepTime] = useState(existing.sleepTime || settings.sleepTime)
  const [sleepQuality, setSleepQuality] = useState(existing.sleepQuality || 0)
  const [meals, setMeals] = useState(() => initMeals(existing.meals))
  const [exercise, setExercise] = useState(existing.exercise ?? false)
  const [exerciseStart, setExerciseStart] = useState(existing.exerciseStart || '')
  const [exerciseDuration, setExerciseDuration] = useState(existing.exerciseDuration || '')

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
    saveRecord(today, {
      date: today,
      wakeTime,
      sleepTime,
      sleepQuality,
      sleepHours: calcSleepHours(),
      wakeOnTime: calcWakeOnTime(),
      meals,
      exercise,
      exerciseStart: exercise ? exerciseStart : '',
      exerciseDuration: exercise ? exerciseDuration : '',
      completed: true,
      completedAt: new Date().toISOString(),
    })
    navigate('/records')
  }

  const updateMeal = (key, patch) =>
    setMeals(m => ({ ...m, [key]: { ...m[key], ...patch } }))

  const progress = ((step + 1) / totalSteps) * 100

  return (
    <div
      className="page-no-nav fade-up"
      style={{ background: 'white', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #6C5CE7 0%, #a29bfe 100%)',
        padding: '20px 20px 32px',
        paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
        color: 'white',
        position: 'relative',
        flexShrink: 0,
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
        <div style={{ height: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'white', borderRadius: 2, transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ position: 'absolute', bottom: -20, left: 0, right: 0, height: 40, background: '#FAFAFA', borderRadius: '20px 20px 0 0' }} />
      </div>

      {/* Content — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 20px 24px', background: '#FAFAFA' }}>
        {step === 0 && (
          <StepSleep
            wakeTime={wakeTime}
            sleepTime={sleepTime}
            onWakeChange={setWakeTime}
            onSleepChange={setSleepTime}
            sleepHours={calcSleepHours()}
            onTime={calcWakeOnTime()}
          />
        )}
        {step === 1 && (
          <StepQuality value={sleepQuality} onChange={setSleepQuality} />
        )}
        {step === 2 && (
          <StepMeals meals={meals} onUpdate={updateMeal} />
        )}
        {step === 3 && (
          <StepExercise
            exercise={exercise}
            onToggle={() => setExercise(e => !e)}
            exerciseStart={exerciseStart}
            onStartChange={setExerciseStart}
            exerciseDuration={exerciseDuration}
            onDurationChange={setExerciseDuration}
          />
        )}
      </div>

      {/* Bottom button */}
      <div style={{ padding: '16px 20px', paddingBottom: 'max(24px, calc(env(safe-area-inset-bottom) + 16px))', background: '#FAFAFA', borderTop: '1px solid #EEE', flexShrink: 0 }}>
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

// ─── Step 1: 수면 ─────────────────────────────────────────────────────────────

function StepSleep({ wakeTime, sleepTime, onWakeChange, onSleepChange, sleepHours, onTime }) {
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

// ─── Step 2: 수면 질 ──────────────────────────────────────────────────────────

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
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} className={`star-btn${n <= value ? ' active' : ''}`} onClick={() => onChange(n)}>⭐</button>
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

// ─── Step 3: 식사 ─────────────────────────────────────────────────────────────

const MEAL_ITEMS = [
  { key: 'breakfast', label: '아침', icon: '🍳' },
  { key: 'lunch',     label: '점심', icon: '🥗' },
  { key: 'dinner',    label: '저녁', icon: '🍚' },
  { key: 'latenight', label: '야식', icon: '🌙' },
]

function StepMeals({ meals, onUpdate }) {
  const eatenCount = MEAL_ITEMS.filter(({ key }) => !meals[key].skipped).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>식사 기록</h2>
        <p style={{ fontSize: 14, color: '#6E6E8A' }}>각 식사의 시작 시간을 입력해주세요</p>
      </div>
      <div className="card">
        {MEAL_ITEMS.map(({ key, label, icon }, i) => {
          const meal = meals[key]
          return (
            <div
              key={key}
              style={{
                padding: '14px 20px',
                borderBottom: i < MEAL_ITEMS.length - 1 ? '1px solid #F0EFF8' : 'none',
              }}
            >
              {/* Row: icon + label + 안 먹었어요 checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: meal.skipped ? 0 : 10 }}>
                <span style={{ fontSize: 24 }}>{icon}</span>
                <span style={{ fontWeight: 600, fontSize: 15, flex: 1 }}>{label}</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#A0A0B8', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={meal.skipped}
                    onChange={() => onUpdate(key, { skipped: !meal.skipped })}
                    style={{ accentColor: '#6C5CE7', width: 16, height: 16 }}
                  />
                  안 먹었어요
                </label>
              </div>
              {/* Time input — only when not skipped */}
              {!meal.skipped && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: '#6E6E8A', whiteSpace: 'nowrap' }}>먹기 시작한 시간</span>
                  <input
                    type="time"
                    value={meal.time}
                    onChange={e => onUpdate(key, { time: e.target.value })}
                    className="input input-time"
                    style={{ flex: 1 }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ textAlign: 'center', fontSize: 13, color: '#A0A0B8' }}>
        {eatenCount}끼 식사 완료
      </div>
    </div>
  )
}

// ─── Step 4: 운동 ─────────────────────────────────────────────────────────────

function StepExercise({ exercise, onToggle, exerciseStart, onStartChange, exerciseDuration, onDurationChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>운동 기록</h2>
        <p style={{ fontSize: 14, color: '#6E6E8A' }}>오늘 운동을 하셨나요?</p>
      </div>

      {/* 안 했어요 checkbox */}
      <div className="card card-body">
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={!exercise}
            onChange={onToggle}
            style={{ accentColor: '#6C5CE7', width: 18, height: 18 }}
          />
          <span style={{ fontSize: 15, fontWeight: 600, color: !exercise ? '#6C5CE7' : '#333' }}>
            안 했어요
          </span>
        </label>
      </div>

      {/* 운동 상세 — only when exercised */}
      {exercise && (
        <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="input-group">
            <label className="input-label">운동 시작 시간</label>
            <input
              type="time"
              value={exerciseStart}
              onChange={e => onStartChange(e.target.value)}
              className="input input-time"
            />
          </div>
          <div style={{ height: 1, background: '#EEE' }} />
          <div className="input-group">
            <label className="input-label">운동한 시간</label>
            <input
              type="text"
              value={exerciseDuration}
              onChange={e => onDurationChange(e.target.value)}
              className="input"
              placeholder="예: 30분, 1시간, 1시간 30분"
            />
          </div>
        </div>
      )}

      {!exercise && (
        <div style={{ textAlign: 'center', paddingTop: 12 }}>
          <div style={{ fontSize: 48 }}>🛋️</div>
          <div style={{ fontSize: 14, color: '#A0A0B8', marginTop: 8 }}>괜찮아요, 내일 운동해요!</div>
        </div>
      )}
    </div>
  )
}
